import { create } from 'zustand'
import type {
    DebateMessage,
    AgentThinking,
    RoundEvaluation,
    FinalVerdict,
    DebateStandings
} from '@/types'

// 扩展消息类型，包含思考过程
export interface AgentDebateMessage extends DebateMessage {
    thinking?: AgentThinking['content']
    confidence?: number
}

interface AgentDebateState {
    // 基础状态
    messages: AgentDebateMessage[]
    isLoading: boolean
    error: string | null
    topic: string
    sessionId: number | null

    // Multi-Agent 特有状态
    mode: 'standard' | 'agent'  // 辩论模式
    thinkings: AgentThinking[]  // 思考过程记录
    evaluations: RoundEvaluation[]  // 各轮评估
    standings: DebateStandings | null  // 实时比分
    verdict: FinalVerdict | null  // 最终裁决
    currentRound: number
    totalRounds: number

    // UI 状态
    showThinking: boolean  // 是否显示思考过程
    showScores: boolean  // 是否显示评分

    // Actions
    addMessage: (message: AgentDebateMessage) => void
    updateMessage: (index: number, content: string) => void
    addThinking: (thinking: AgentThinking) => void
    addEvaluation: (evaluation: RoundEvaluation) => void
    setStandings: (standings: DebateStandings) => void
    setVerdict: (verdict: FinalVerdict) => void
    setSessionId: (id: number) => void
    setCurrentRound: (round: number) => void
    setTotalRounds: (rounds: number) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    setTopic: (topic: string) => void
    setMode: (mode: 'standard' | 'agent') => void
    toggleShowThinking: () => void
    toggleShowScores: () => void
    clear: () => void
}

export const useAgentDebateStore = create<AgentDebateState>((set) => ({
    // 初始状态
    messages: [],
    isLoading: false,
    error: null,
    topic: '',
    sessionId: null,

    mode: 'agent',
    thinkings: [],
    evaluations: [],
    standings: null,
    verdict: null,
    currentRound: 0,
    totalRounds: 3,

    showThinking: true,
    showScores: true,

    // Actions
    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    updateMessage: (index, content) => set((state) => ({
        messages: state.messages.map((msg, idx) =>
            idx === index ? { ...msg, content } : msg
        )
    })),

    addThinking: (thinking) => set((state) => ({
        thinkings: [...state.thinkings, thinking]
    })),

    addEvaluation: (evaluation) => set((state) => ({
        evaluations: [...state.evaluations, evaluation]
    })),

    setStandings: (standings) => set({ standings }),

    setVerdict: (verdict) => set({ verdict }),

    setSessionId: (id) => set({ sessionId: id }),

    setCurrentRound: (round) => set({ currentRound: round }),

    setTotalRounds: (rounds) => set({ totalRounds: rounds }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    setTopic: (topic) => set({ topic }),

    setMode: (mode) => set({ mode }),

    toggleShowThinking: () => set((state) => ({ showThinking: !state.showThinking })),

    toggleShowScores: () => set((state) => ({ showScores: !state.showScores })),

    clear: () => set({
        messages: [],
        error: null,
        topic: '',
        sessionId: null,
        thinkings: [],
        evaluations: [],
        standings: null,
        verdict: null,
        currentRound: 0,
    }),
}))
