import { useCallback, useRef, useState } from 'react'

interface SSEStreamState {
    isStreaming: boolean
    error: string | null
}

interface UseSSEStreamReturn {
    isStreaming: boolean
    error: string | null
    start: (url: string, onEvent: (event: unknown) => void) => Promise<void>
    stop: () => void
}

/**
 * 通用 SSE 流式请求 Hook
 *
 * 封装了：
 * - 流式连接的生命周期管理（开始/停止）
 * - isStreaming / error 状态
 * - AbortController 取消支持
 *
 * 用法：
 *   const { isStreaming, error, start, stop } = useSSEStream()
 *   await start(url, (event) => { ... })
 */
export function useSSEStream(): UseSSEStreamReturn {
    const [state, setState] = useState<SSEStreamState>({ isStreaming: false, error: null })
    const abortRef = useRef<AbortController | null>(null)

    const stop = useCallback(() => {
        abortRef.current?.abort()
        abortRef.current = null
        setState({ isStreaming: false, error: null })
    }, [])

    const start = useCallback(async (url: string, onEvent: (event: unknown) => void): Promise<void> => {
        // 终止已有连接
        abortRef.current?.abort()

        const controller = new AbortController()
        abortRef.current = controller

        setState({ isStreaming: true, error: null })

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'text/event-stream' },
                signal: controller.signal,
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const rawLine of lines) {
                    const line = rawLine.trim()
                    if (!line.startsWith('data:')) continue

                    const payload = line.slice(5).trim()
                    if (!payload || payload === '[DONE]') continue

                    try {
                        onEvent(JSON.parse(payload))
                    } catch {
                        console.error('Failed to parse SSE data:', payload)
                    }
                }
            }

            setState({ isStreaming: false, error: null })
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                // 用户主动取消，不视为错误
                setState({ isStreaming: false, error: null })
                return
            }
            const message = err instanceof Error ? err.message : String(err)
            setState({ isStreaming: false, error: message })
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null
            }
        }
    }, [])

    return { isStreaming: state.isStreaming, error: state.error, start, stop }
}
