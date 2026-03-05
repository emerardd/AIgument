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

export interface ChatHistoryItem {
    role: 'user' | 'assistant' | 'system'
    content: string
}

export interface DualChatRole {
    id: string
    name: string
    persona: string
    style: string
    position: string
}

export interface QAMode {
    id: string
    name: string
    description: string
    icon: string
}

// ====== 辩论 API ======

export const debateAPI = {
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

    createDebate: (settings: DebateSettings) =>
        api.post<DebateSession>('/api/debate', settings),

    singleRound: (data: { topic: string; round: number }) =>
        api.post('/api/debate/single', data),

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
    sendMessage: (
        message: string,
        provider?: string,
        model?: string,
        sessionId?: number,
        history?: ChatHistoryItem[]
    ) =>
        api.post<{ session_id: number; message?: { role: string; content: string }; content?: string }>('/api/chat', {
            message,
            provider,
            model,
            session_id: sessionId,
            history: history || [],
        }),

    streamChat: async (
        message: string,
        onEvent: (event: { type: string; content?: string; role?: string; session_id?: number }) => void,
        onError: (error: Error) => void,
        provider?: string,
        model?: string,
        history?: ChatHistoryItem[],
        sessionId?: number
    ) => {
        const params = new URLSearchParams({ message })
        if (provider) params.set('provider', provider)
        if (model) params.set('model', model)
        if (history && history.length > 0) params.set('history', JSON.stringify(history))
        if (sessionId) params.set('session_id', String(sessionId))

        await streamWithParams<{ type: string; content?: string; role?: string; session_id?: number }>(
            '/api/chat/stream',
            params,
            onEvent,
            onError
        )
    },

    getRoles: () => api.get<{ roles: DualChatRole[] }>('/api/chat/roles'),

    streamDualChat: async (
        topic: string,
        roleA: string,
        roleB: string,
        turns: number,
        onEvent: (event: Record<string, unknown>) => void,
        onError: (error: Error) => void,
        provider?: string,
        model?: string
    ) => {
        const params = new URLSearchParams({
            topic,
            role_a: roleA,
            role_b: roleB,
            turns: String(turns),
        })
        if (provider) params.set('provider', provider)
        if (model) params.set('model', model)

        await streamWithParams<Record<string, unknown>>('/api/chat/dual-stream', params, onEvent, onError)
    },
}

// ====== 问答 API ======

export const qaAPI = {
    askQuestion: (
        question: string,
        style?: string,
        provider?: string,
        model?: string,
        sessionId?: number,
        history?: ChatHistoryItem[]
    ) =>
        api.post<{ session_id: number; answer: string; style: string }>('/api/qa', {
            question,
            style,
            provider,
            model,
            session_id: sessionId,
            history: history || [],
        }),

    streamQA: async (
        question: string,
        onEvent: (event: { type: string; content?: string; role?: string; session_id?: number }) => void,
        onError: (error: Error) => void,
        style?: string,
        provider?: string,
        model?: string,
        history?: ChatHistoryItem[],
        sessionId?: number
    ) => {
        const params = new URLSearchParams({ question })
        if (style) params.set('style', style)
        if (provider) params.set('provider', provider)
        if (model) params.set('model', model)
        if (history && history.length > 0) params.set('history', JSON.stringify(history))
        if (sessionId) params.set('session_id', String(sessionId))

        await streamWithParams<{ type: string; content?: string; role?: string; session_id?: number }>(
            '/api/qa/stream',
            params,
            onEvent,
            onError
        )
    },

    getModes: () => api.get<{ modes: QAMode[] }>('/api/qa/modes'),

    streamSocraticQA: async (
        question: string,
        mode: 'socratic' | 'structured' | 'hybrid',
        onEvent: (event: { type: string; content?: string; session_id?: number; error?: string }) => void,
        onError: (error: Error) => void,
        provider?: string,
        model?: string,
        history?: ChatHistoryItem[],
        sessionId?: number
    ) => {
        const params = new URLSearchParams({ question, mode })
        if (provider) params.set('provider', provider)
        if (model) params.set('model', model)
        if (history && history.length > 0) params.set('history', JSON.stringify(history))
        if (sessionId) params.set('session_id', String(sessionId))

        await streamWithParams<{ type: string; content?: string; session_id?: number; error?: string }>(
            '/api/qa/socratic-stream',
            params,
            onEvent,
            onError
        )
    },
}

// ====== 历史记录 API ======

export const historyAPI = {
    getHistory: (type: SessionType | 'all' = 'all', limit = 100, offset = 0) =>
        api.get<{ history: HistoryItem[]; total: number; limit: number; offset: number; has_more: boolean }>(
            `/api/history?type=${type}&limit=${limit}&offset=${offset}`
        ),

    getSession: (id: number) => api.get<{
        session_id: number
        messages: Array<{
            role: string
            content: string
            created_at: string
            meta_info?: Record<string, unknown>
        }>
    }>(`/api/history/${id}`),

    deleteSession: (id: number) => api.delete(`/api/history/${id}`),

    exportSession: (id: number, format: 'md' | 'json' | 'txt' = 'md') =>
        api.get(`/api/history/${id}/export?format=${format === 'md' ? 'markdown' : format}`, {
            responseType: 'blob',
        }),
}

export default api
