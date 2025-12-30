import { useCallback, useRef, useState } from 'react'

interface SSEOptions {
    onContent?: (content: string) => void
    onComplete?: () => void
    onError?: (error: Error) => void
    onReconnect?: (attempt: number) => void
    /** 最大重试次数，默认 3 */
    maxRetries?: number
    /** 重试延迟（毫秒），默认 1000 */
    retryDelay?: number
}

interface SSEState {
    isLoading: boolean
    error: string | null
    content: string
    retryCount: number
}

/**
 * 通用 SSE 流式处理 Hook
 * 
 * 支持自动重连、错误处理和取消
 */
export function useSSE() {
    const [state, setState] = useState<SSEState>({
        isLoading: false,
        error: null,
        content: '',
        retryCount: 0,
    })
    const abortControllerRef = useRef<AbortController | null>(null)
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const currentUrlRef = useRef<string>('')
    const currentOptionsRef = useRef<SSEOptions>({})

    const clearRetryTimeout = () => {
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current)
            retryTimeoutRef.current = null
        }
    }

    const attemptConnection = useCallback(
        async (url: string, options: SSEOptions, retryCount: number = 0) => {
            const maxRetries = options.maxRetries ?? 3
            const retryDelay = options.retryDelay ?? 1000

            // 取消之前的请求
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            abortControllerRef.current = new AbortController()

            setState((prev) => ({
                ...prev,
                isLoading: true,
                error: null,
                retryCount
            }))

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

                // 连接成功，重置重试计数
                setState((prev) => ({ ...prev, retryCount: 0 }))

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
                                    setState({ isLoading: false, error: errorMsg, content: accumulatedContent, retryCount: 0 })
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

                // 检查是否应该重试（网络错误等可恢复的错误）
                const isRetryable =
                    error instanceof TypeError || // 网络错误
                    (error instanceof Error && error.message.includes('Failed to fetch'))

                if (isRetryable && retryCount < maxRetries) {
                    // 触发重连
                    const nextRetry = retryCount + 1
                    console.log(`SSE 连接失败，${retryDelay}ms 后重试 (${nextRetry}/${maxRetries})`)
                    options.onReconnect?.(nextRetry)

                    setState((prev) => ({
                        ...prev,
                        error: `连接失败，正在重试 (${nextRetry}/${maxRetries})...`,
                        retryCount: nextRetry
                    }))

                    retryTimeoutRef.current = setTimeout(() => {
                        attemptConnection(url, options, nextRetry)
                    }, retryDelay * Math.pow(2, retryCount)) // 指数退避
                } else {
                    setState({ isLoading: false, error: errorMsg, content: '', retryCount: 0 })
                    options.onError?.(error instanceof Error ? error : new Error(errorMsg))
                }
            }
        },
        []
    )

    const startSSE = useCallback(
        async (url: string, options: SSEOptions = {}) => {
            clearRetryTimeout()
            currentUrlRef.current = url
            currentOptionsRef.current = options
            setState({ isLoading: true, error: null, content: '', retryCount: 0 })
            await attemptConnection(url, options, 0)
        },
        [attemptConnection]
    )

    const cancel = useCallback(() => {
        clearRetryTimeout()
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        setState((prev) => ({ ...prev, isLoading: false, retryCount: 0 }))
    }, [])

    const reset = useCallback(() => {
        clearRetryTimeout()
        setState({ isLoading: false, error: null, content: '', retryCount: 0 })
    }, [])

    const retry = useCallback(() => {
        if (currentUrlRef.current) {
            startSSE(currentUrlRef.current, currentOptionsRef.current)
        }
    }, [startSSE])

    return {
        ...state,
        startSSE,
        cancel,
        reset,
        retry,
    }
}

