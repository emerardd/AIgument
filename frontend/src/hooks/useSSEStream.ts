import { useCallback, useRef, useState } from 'react'
import { streamSSE } from '@/utils/sse'

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
            await streamSSE({ url, onEvent, signal: controller.signal })

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
