import { create } from 'zustand'
import type { AgentStreamEvent } from '@/types'
import {
    initialAgentDebateRun,
    reduceAgentDebateEvent,
    type AgentDebateRunState,
} from '@/features/debate/agentDebateReducer'

export type { AgentDebateMessage } from '@/features/debate/agentDebateReducer'

interface AgentDebateState extends AgentDebateRunState {
    topic: string
    totalRounds: number
    isLoading: boolean
    error: string | null

    showThinking: boolean
    showScores: boolean

    /** Clear the previous result and mark a new run as loading. */
    beginRun: (topic: string, totalRounds: number) => void
    applyEvent: (event: AgentStreamEvent) => void
    endRun: (error?: string | null) => void
    toggleShowThinking: () => void
    toggleShowScores: () => void
}

export const useAgentDebateStore = create<AgentDebateState>((set) => ({
    ...initialAgentDebateRun,
    topic: '',
    totalRounds: 3,
    isLoading: false,
    error: null,

    showThinking: true,
    showScores: true,

    beginRun: (topic, totalRounds) => set({
        ...initialAgentDebateRun,
        topic,
        totalRounds,
        isLoading: true,
        error: null,
    }),

    applyEvent: (event) => set((state) => {
        const next = reduceAgentDebateEvent(state, event)
        return next === state ? state : next
    }),

    endRun: (error = null) => set({ isLoading: false, error }),

    toggleShowThinking: () => set((state) => ({ showThinking: !state.showThinking })),
    toggleShowScores: () => set((state) => ({ showScores: !state.showScores })),
}))
