import axios from 'axios'
import type {
    DebateSettings,
    DebateSession,
    HistoryItem,
    SessionType,
    StreamEvent,
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// ====== 辩论 API ======

export const debateAPI = {
    /**
     * 流式辩论 - 使用 Server-Sent Events
     */
    streamDebate: async (
        settings: DebateSettings,
        onEvent: (event: StreamEvent) => void,
        onError: (error: Error) => void
    ) => {
        try {
            const params = new URLSearchParams({
                topic: settings.topic,
                rounds: settings.rounds.toString(),
                provider: settings.provider,
                model: settings.model,
            })

            const response = await fetch(
                `${API_BASE_URL}/api/debate/stream?${params}`,
                { method: 'GET' }
            )

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
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            onEvent(data)
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e)
                        }
                    }
                }
            }
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Unknown error'))
        }
    },

    /**
     * 普通辩论（非流式）
     */
    createDebate: (settings: DebateSettings) =>
        api.post<DebateSession>('/api/debate', settings),

    /**
     * 单轮辩论
     */
    singleRound: (data: { topic: string; round: number }) =>
        api.post('/api/debate/single', data),
}

// ====== 对话 API ======

export const chatAPI = {
    /**
     * 发送对话消息（非流式）
     */
    sendMessage: (message: string, provider?: string, model?: string, sessionId?: number) =>
        api.post<{ session_id: number; role: string; content: string }>('/api/chat', {
            message, provider, model, session_id: sessionId
        }),

    /**
     * 流式对话
     */
    streamChat: async (
        message: string,
        onEvent: (event: { type: string; content?: string; role?: string; session_id?: number }) => void,
        onError: (error: Error) => void,
        provider?: string,
        model?: string
    ) => {
        try {
            const params = new URLSearchParams({ message })
            if (provider) params.set('provider', provider)
            if (model) params.set('model', model)

            const response = await fetch(`${API_BASE_URL}/api/chat/stream?${params}`, {
                method: 'GET',
            })

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''

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
                            onEvent(data)
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e)
                        }
                    }
                }
            }
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Unknown error'))
        }
    },
}

// ====== 问答 API ======

export const qaAPI = {
    /**
     * 提交问题（非流式）
     */
    askQuestion: (question: string, style?: string, provider?: string, model?: string, sessionId?: number) =>
        api.post<{ session_id: number; answer: string; style: string }>('/api/qa', {
            question, style, provider, model, session_id: sessionId
        }),

    /**
     * 流式问答
     */
    streamQA: async (
        question: string,
        onEvent: (event: { type: string; content?: string; role?: string; session_id?: number }) => void,
        onError: (error: Error) => void,
        style?: string,
        provider?: string,
        model?: string
    ) => {
        try {
            const params = new URLSearchParams({ question })
            if (style) params.set('style', style)
            if (provider) params.set('provider', provider)
            if (model) params.set('model', model)

            const response = await fetch(`${API_BASE_URL}/api/qa/stream?${params}`, {
                method: 'GET',
            })

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''

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
                            onEvent(data)
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e)
                        }
                    }
                }
            }
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Unknown error'))
        }
    },
}

// ====== 历史记录 API ======

export const historyAPI = {
    /**
     * 获取历史记录列表
     */
    getHistory: (type: SessionType | 'all' = 'all') =>
        api.get<{ history: HistoryItem[] }>(`/api/history?type=${type}`),

    /**
     * 获取单个会话详情
     */
    getSession: (id: number) => api.get<{
        session_id: number
        messages: Array<{
            role: string
            content: string
            created_at: string
            meta_info?: Record<string, unknown>
        }>
    }>(`/api/history/${id}`),

    /**
     * 删除会话
     */
    deleteSession: (id: number) => api.delete(`/api/history/${id}`),

    /**
     * 导出会话
     */
    exportSession: (id: number, format: 'md' | 'json' | 'txt' = 'md') =>
        api.get(`/api/history/${id}/export?format=${format === 'md' ? 'markdown' : format}`, {
            responseType: 'blob',
        }),
}

export default api
