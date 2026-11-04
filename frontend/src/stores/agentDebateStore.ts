import { create } from 'zustand'
import type { AgentStreamEvent } from '@/types'
import {
    initialAgentDebateRun,
    reduceAgentDebateEvent,
    type AgentDebateRunState,
} from '@/features/debate/agentDebateReducer'

export type { AgentDebateMessage } from '@/features/debate/agentDebateReducer'

export interface SideModels {
    pro: string
    con: string
}

interface AgentDebateState extends AgentDebateRunState {
    topic: string
    models: SideModels | null
    totalRounds: number
    isLoading: boolean
    error: string | null

    showThinking: boolean
    showScores: boolean

    /** Clear the previous result and mark a new run as loading. */
    beginRun: (topic: string, totalRounds: number, models: SideModels) => void
    /** Leave the finished debate and go back to the setup form. */
    reset: () => void
    applyEvent: (event: AgentStreamEvent) => void
    endRun: (error?: string | null) => void
    toggleShowThinking: () => void
    toggleShowScores: () => void
}

export const useAgentDebateStore = create<AgentDebateState>((set) => ({
    ...initialAgentDebateRun,
    topic: '',
    models: null,
    totalRounds: 3,
    isLoading: false,
    error: null,

    showThinking: true,
    showScores: true,

    beginRun: (topic, totalRounds, models) => set({
        ...initialAgentDebateRun,
        topic,
        totalRounds,
        models,
        isLoading: true,
        error: null,
    }),

    applyEvent: (event) => set((state) => {
        const next = reduceAgentDebateEvent(state, event)
        return next === state ? state : next
    }),

    endRun: (error = null) => set({ isLoading: false, error }),

    reset: () => set({ ...initialAgentDebateRun, topic: '', models: null, isLoading: false, error: null }),

    toggleShowThinking: () => set((state) => ({ showThinking: !state.showThinking })),
    toggleShowScores: () => set((state) => ({ showScores: !state.showScores })),
}))
