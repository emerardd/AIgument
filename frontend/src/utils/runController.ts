/**
 * Owns one streamed run at a time.
 *
 * - Starting a new run aborts the previous one, and callbacks from a superseded
 *   run are dropped, so a late event can never overwrite the new run's state.
 * - Each run finishes exactly once with an outcome. A stream that closes without
 *   a `complete` or `error` event is reported as `truncated` instead of leaving
 *   the UI loading forever.
 */

export type RunOutcome = 'completed' | 'failed' | 'cancelled' | 'truncated'

export interface RunEvent {
    type: string
    error?: string
    message?: string
}

export type StreamFn<E> = (
    onEvent: (event: E) => void,
    onError: (error: Error) => void,
    signal: AbortSignal,
) => Promise<void>

export interface RunCallbacks<E> {
    onEvent: (event: E) => void
    onFinish: (outcome: RunOutcome, error?: string) => void
}

export const TRUNCATED_MESSAGE = '连接意外中断，未收到完成事件'

export function createRunController() {
    let activeId = 0
    let controller: AbortController | null = null

    async function start<E extends RunEvent>(stream: StreamFn<E>, callbacks: RunCallbacks<E>): Promise<RunOutcome> {
        controller?.abort()
        const id = ++activeId
        const ctrl = new AbortController()
        controller = ctrl

        let outcome: RunOutcome | null = null
        let errorMessage: string | undefined
        const isCurrent = () => id === activeId && !ctrl.signal.aborted

        await stream(
            (event) => {
                if (!isCurrent() || outcome) return
                if (event.type === 'error') {
                    outcome = 'failed'
                    errorMessage = event.message || event.error || '未知错误'
                    return
                }
                callbacks.onEvent(event)
                if (event.type === 'complete') outcome = 'completed'
            },
            (error) => {
                if (!isCurrent() || outcome) return
                outcome = 'failed'
                errorMessage = error.message
            },
            ctrl.signal,
        )

        if (controller === ctrl) controller = null
        // Superseded or disposed: the newer owner of the state decides what to show.
        if (id !== activeId) return 'cancelled'

        if (!outcome) {
            if (ctrl.signal.aborted) {
                outcome = 'cancelled'
            } else {
                outcome = 'truncated'
                errorMessage = TRUNCATED_MESSAGE
            }
        }
        callbacks.onFinish(outcome, errorMessage)
        return outcome
    }

    /** Stop the current run; its onFinish reports `cancelled`. */
    function cancel() {
        controller?.abort()
    }

    /** Stop the current run without any further callbacks (e.g. on unmount). */
    function dispose() {
        activeId++
        controller?.abort()
        controller = null
    }

    return { start, cancel, dispose }
}

export type RunController = ReturnType<typeof createRunController>
