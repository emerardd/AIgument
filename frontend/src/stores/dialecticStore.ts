import { create } from 'zustand'
import type { DialecticStreamEvent } from '@/types'
import {
    initialDialecticRun,
    reduceDialecticEvent,
    type DialecticRunState,
} from '@/features/dialectic/dialecticReducer'

export type { DialecticMessage } from '@/features/dialectic/dialecticReducer'

interface DialecticState extends DialecticRunState {
    topic: string
    rounds: number
    isLoading: boolean
    error: string | null

    showThinking: boolean
    showFallacies: boolean

    beginRun: (topic: string, rounds: number) => void
    applyEvent: (event: DialecticStreamEvent) => void
    endRun: (error?: string | null) => void
    toggleThinking: () => void
    toggleFallacies: () => void
}

export const useDialecticStore = create<DialecticState>((set) => ({
    ...initialDialecticRun,
    topic: '',
    rounds: 5,
    isLoading: false,
    error: null,

    showThinking: true,
    showFallacies: true,

    beginRun: (topic, rounds) => set({ ...initialDialecticRun, topic, rounds, isLoading: true, error: null }),

    applyEvent: (event) => set((state) => {
        const next = reduceDialecticEvent(state, event)
        return next === state ? state : next
    }),

    endRun: (error = null) => set({ isLoading: false, error }),

    toggleThinking: () => set((state) => ({ showThinking: !state.showThinking })),
    toggleFallacies: () => set((state) => ({ showFallacies: !state.showFallacies })),
}))
