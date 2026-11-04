import { useCallback } from 'react'
import { debateAPI } from '@/services/api'
import { useStreamRun } from '@/hooks/useStreamRun'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import type { AgentStreamEvent, DebateSettings } from '@/types'

/** Connection and cancellation for one agent debate; the store holds the result. */
export function useAgentDebateRun(onProgress?: () => void) {
    const run = useStreamRun()
    const beginRun = useAgentDebateStore(state => state.beginRun)
    const applyEvent = useAgentDebateStore(state => state.applyEvent)
    const endRun = useAgentDebateStore(state => state.endRun)

    const start = useCallback((settings: DebateSettings) => {
        beginRun(settings.topic, settings.rounds, {
            pro: settings.pro_model ?? settings.model,
            con: settings.con_model ?? settings.model,
        })
        onProgress?.()
        return run.start<AgentStreamEvent>(
            (onEvent, onError, signal) => debateAPI.streamAgentDebate(settings, onEvent, onError, signal),
            {
                onEvent: (event) => {
                    applyEvent(event)
                    onProgress?.()
                },
                onFinish: (outcome, error) => endRun(outcome === 'failed' || outcome === 'truncated' ? error : null),
            },
        )
    }, [run, beginRun, applyEvent, endRun, onProgress])

    return { start, cancel: run.cancel }
}
