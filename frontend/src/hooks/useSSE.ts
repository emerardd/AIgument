import { useCallback, useRef, useState } from 'react'

interface SSEOptions {
    onContent?: (content: string) => void
    onComplete?: () => void
    onError?: (error: Error) => void
}

interface SSEState {
    isLoading: boolean
    error: string | null
    content: string
}

/**
 * 通用 SSE 流式处理 Hook
 * 用于处理 Server-Sent Events 流式响应
 */
export function useSSE() {
    const [state, setState] = useState<SSEState>({
        isLoading: false,
        error: null,
        content: '',
    })
    const abortControllerRef = useRef<AbortController | null>(null)

    const startSSE = useCallback(
        async (url: string, options: SSEOptions = {}) => {
            // 取消之前的请求
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            abortControllerRef.current = new AbortController()

            setState({ isLoading: true, error: null, content: '' })

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    signal: abortControllerRef.current.signal,
                })

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const reader = response.body?.getReader()
                if (!reader) throw new Error('No response body')

                const decoder = new TextDecoder()
                let buffer = ''
                let accumulatedContent = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))

                                if (data.type === 'content' && data.content) {
                                    accumulatedContent = data.content
                                    setState((prev) => ({ ...prev, content: accumulatedContent }))
                                    options.onContent?.(accumulatedContent)
                                } else if (data.type === 'complete') {
                                    setState((prev) => ({ ...prev, isLoading: false }))
                                    options.onComplete?.()
                                } else if (data.type === 'error') {
                                    const errorMsg = data.message || data.error || '未知错误'
                                    setState({ isLoading: false, error: errorMsg, content: accumulatedContent })
                                    options.onError?.(new Error(errorMsg))
                                }
                            } catch {
                                console.error('Failed to parse SSE data:', line)
                            }
                        }
                    }
                }

                setState((prev) => ({ ...prev, isLoading: false }))
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    // 请求被取消，不处理
                    return
                }
                const errorMsg = error instanceof Error ? error.message : '未知错误'
                setState({ isLoading: false, error: errorMsg, content: '' })
                options.onError?.(error instanceof Error ? error : new Error(errorMsg))
            }
        },
        []
    )

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        setState((prev) => ({ ...prev, isLoading: false }))
    }, [])

    const reset = useCallback(() => {
        setState({ isLoading: false, error: null, content: '' })
    }, [])

    return {
        ...state,
        startSSE,
        cancel,
        reset,
    }
}
