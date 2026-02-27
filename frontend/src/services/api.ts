import axios from 'axios'
import type {
    AgentStreamEvent,
    DialecticStreamEvent,
    DebateSettings,
    DebateSession,
    HistoryItem,
    SessionType,
    StreamEvent,
} from '@/types'
import { API_BASE_URL } from '@/config/env'
import { streamSSE } from '@/utils/sse'

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

function buildStreamParams(settings: DebateSettings): URLSearchParams {
    const params = new URLSearchParams({
        topic: settings.topic,
        rounds: settings.rounds.toString(),
        provider: settings.provider,
        model: settings.model,
    })
    // 混合模型参数
    if (settings.pro_provider) params.set('pro_provider', settings.pro_provider)
    if (settings.pro_model) params.set('pro_model', settings.pro_model)
    if (settings.con_provider) params.set('con_provider', settings.con_provider)
    if (settings.con_model) params.set('con_model', settings.con_model)
    return params
}

async function streamWithParams<TEvent>(
    path: string,
    params: URLSearchParams,
    onEvent: (event: TEvent) => void,
    onError: (error: Error) => void
): Promise<void> {
    try {
        await streamSSE<TEvent>({
            url: `${API_BASE_URL}${path}?${params.toString()}`,
            onEvent,
        })
    } catch (error) {
        onError(error instanceof Error ? error : new Error('Unknown error'))
    }
}

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
        await streamWithParams<StreamEvent>(
            '/api/debate/stream',
            buildStreamParams(settings),
            onEvent,
            onError
        )
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

    /**
     * Multi-Agent 流式辩论 - 使用 DebateOrchestrator
     * 支持思考过程、评分和最终裁决
     */
    streamAgentDebate: async (
        settings: DebateSettings,
        onEvent: (event: AgentStreamEvent) => void,
        onError: (error: Error) => void
    ) => {
        await streamWithParams<AgentStreamEvent>(
            '/api/debate/agent-stream',
            buildStreamParams(settings),
            onEvent,
            onError
        )
    },
}

// ====== 辩证法引擎 API ======

export const dialecticAPI = {
    streamDialectic: async (
        settings: DebateSettings,
        onEvent: (event: DialecticStreamEvent) => void,
        onError: (error: Error) => void
    ) => {
        await streamWithParams<DialecticStreamEvent>(
            '/api/dialectic/stream',
            buildStreamParams(settings),
            onEvent,
            onError
        )
    },
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
        const params = new URLSearchParams({ message })
        if (provider) params.set('provider', provider)
        if (model) params.set('model', model)

        await streamWithParams<{ type: string; content?: string; role?: string; session_id?: number }>(
            '/api/chat/stream',
            params,
            onEvent,
            onError
        )
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
        const params = new URLSearchParams({ question })
        if (style) params.set('style', style)
        if (provider) params.set('provider', provider)
        if (model) params.set('model', model)

        await streamWithParams<{ type: string; content?: string; role?: string; session_id?: number }>(
            '/api/qa/stream',
            params,
            onEvent,
            onError
        )
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
