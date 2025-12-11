// ====== 辩论相关类型 ======

export interface DebateMessage {
    role: '正方' | '反方' | 'system' | 'topic'
    content: string
    round?: number
    timestamp?: string
}

export interface DebateSettings {
    topic: string
    rounds: number
    provider: 'deepseek' | 'openai'
    model: string
    stream: boolean
}

export interface DebateSession {
    id: number
    topic: string
    messages: DebateMessage[]
    settings: DebateSettings
    created_at: string
    updated_at?: string
}

// ====== 对话相关类型 ======

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp?: string
}

export interface ChatSettings {
    provider: 'deepseek' | 'openai'
    model: string
    stream: boolean
}

export interface ChatSession {
    id: number
    messages: ChatMessage[]
    settings: ChatSettings
    created_at: string
}

// ====== 问答相关类型 ======

export type QAStyle = 'professional' | 'casual' | 'detailed' | 'concise'

export interface QARequest {
    question: string
    style: QAStyle
    provider: 'deepseek' | 'openai'
    model: string
}

export interface QAResponse {
    answer: string
    timestamp: string
}

// ====== 历史记录类型 ======

export type SessionType = 'debate' | 'chat' | 'qa'

export interface HistoryItem {
    session_id: number
    topic: string
    start_time: string
    message_count: number
    type: SessionType
}

// ====== API响应类型 ======

export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

export interface StreamEvent {
    type: 'content' | 'complete' | 'error'
    round?: number
    side?: '正方' | '反方'
    content?: string
    message?: string
    error?: string
}
