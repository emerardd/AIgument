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
    provider: 'deepseek' | 'openai' | 'gemini' | 'claude'
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

export type SessionType = 'debate' | 'chat' | 'qa' | 'dialectic'

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

// ====== Multi-Agent 辩论类型 ======

export interface AgentThinking {
    side: 'pro' | 'con'
    name: string
    content: {
        opponent_main_points?: string[]
        opponent_weaknesses?: string[]
        selected_strategy?: string
        strategy_reason?: string
        counter_points?: string[]
        new_arguments?: string[]
        topic_analysis?: string
        core_stance?: string
        opening_strategy?: string
        key_arguments?: string[]
        anticipated_opposition?: string[]
    }
    confidence: number
    round: number
}

export interface RoundScore {
    logic: number
    evidence: number
    rhetoric: number
    rebuttal: number
}

export interface RoundEvaluation {
    round: number
    pro_score: RoundScore
    con_score: RoundScore
    round_winner: 'pro' | 'con' | 'tie'
    commentary: string
    highlights: string[]
    suggestions: {
        pro?: string[]
        con?: string[]
    }
}

export interface FinalVerdict {
    winner: 'pro' | 'con' | 'tie'
    pro_total_score: number
    con_total_score: number
    margin: 'decisive' | 'close' | 'marginal'
    summary: string
    pro_strengths: string[]
    con_strengths: string[]
    key_turning_points: string[]
}

export interface DebateStandings {
    current_round: number
    total_rounds: number
    pro_total_score: number
    con_total_score: number
    pro_round_wins: number
    con_round_wins: number
    status: 'not_started' | 'in_progress' | 'completed'
}

export type AgentStreamEventType =
    | 'session'
    | 'opening'
    | 'round_start'
    | 'thinking'
    | 'argument'
    | 'argument_complete'
    | 'evaluation'
    | 'standings'
    | 'verdict'
    | 'complete'
    | 'error'

export interface AgentStreamEvent {
    type: AgentStreamEventType
    round?: number
    side?: 'pro' | 'con'
    name?: string
    content?: string | Record<string, unknown>
    session_id?: number
    topic?: string
    total_rounds?: number
    confidence?: number
    // 评估相关
    pro_score?: RoundScore
    con_score?: RoundScore
    round_winner?: 'pro' | 'con' | 'tie'
    commentary?: string
    highlights?: string[]
    suggestions?: Record<string, string[]>
    // 比分
    standings?: DebateStandings
    // 裁决
    winner?: 'pro' | 'con' | 'tie'
    pro_total_score?: number
    con_total_score?: number
    margin?: string
    summary?: string
    pro_strengths?: string[]
    con_strengths?: string[]
    key_turning_points?: string[]
    // 错误
    error?: string
    message?: string
}

// ====== 辩证法引擎类型 ======

export interface FallacyItem {
    type: string
    quote: string
    explanation: string
    severity: 'low' | 'medium' | 'high'
    side: 'thesis' | 'antithesis'
}

export interface DialecticNode {
    id: string
    type?: string
    position: { x: number; y: number }
    data: {
        label: string
        kind: 'thesis' | 'antithesis' | 'synthesis'
        round: number
    }
}

export interface DialecticEdge {
    id: string
    source: string
    target: string
    label?: string
    type?: string
    animated?: boolean
}

export interface DialecticTree {
    nodes: DialecticNode[]
    edges: DialecticEdge[]
}

export type DialecticStreamEventType =
    | 'session'
    | 'opening'
    | 'round_start'
    | 'thesis'
    | 'antithesis'
    | 'synthesis'
    | 'fallacy'
    | 'tree_update'
    | 'complete'
    | 'error'

export interface DialecticStreamEvent {
    type: DialecticStreamEventType
    round?: number
    side?: 'thesis' | 'antithesis' | 'synthesis'
    content?: string
    thinking?: Record<string, unknown>
    items?: FallacyItem[]
    nodes?: DialecticNode[]
    edges?: DialecticEdge[]
    trace?: Record<string, unknown>
    tree?: DialecticTree
    session_id?: number
    topic?: string
    total_rounds?: number
    error?: string
    message?: string
}

