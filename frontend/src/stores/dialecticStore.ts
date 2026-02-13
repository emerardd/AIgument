import { create } from 'zustand'
import type {
    DialecticTree,
    FallacyItem,
} from '@/types'

export interface DialecticMessage {
    round: number
    role: '正题' | '反题' | '合题'
    content: string
    thinking?: Record<string, unknown>
}

interface DialecticState {
    topic: string
    sessionId: number | null
    rounds: number
    currentRound: number
    isLoading: boolean
    error: string | null

    messages: DialecticMessage[]
    fallaciesByRound: Record<number, FallacyItem[]>
    tree: DialecticTree | null

    showThinking: boolean
    showFallacies: boolean

    setTopic: (topic: string) => void
    setSessionId: (id: number) => void
    setRounds: (rounds: number) => void
    setCurrentRound: (round: number) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    addMessage: (message: DialecticMessage) => void
    setFallacies: (round: number, items: FallacyItem[]) => void
    setTree: (tree: DialecticTree) => void
    toggleThinking: () => void
    toggleFallacies: () => void
    clear: () => void
}

export const useDialecticStore = create<DialecticState>((set) => ({
    topic: '',
    sessionId: null,
    rounds: 5,
    currentRound: 0,
    isLoading: false,
    error: null,

    messages: [],
    fallaciesByRound: {},
    tree: null,

    showThinking: true,
    showFallacies: true,

    setTopic: (topic) => set({ topic }),
    setSessionId: (id) => set({ sessionId: id }),
    setRounds: (rounds) => set({ rounds }),
    setCurrentRound: (round) => set({ currentRound: round }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    setFallacies: (round, items) => set((state) => ({
        fallaciesByRound: {
            ...state.fallaciesByRound,
            [round]: items
        }
    })),

    setTree: (tree) => set({ tree }),

    toggleThinking: () => set((state) => ({ showThinking: !state.showThinking })),
    toggleFallacies: () => set((state) => ({ showFallacies: !state.showFallacies })),

    clear: () => set({
        topic: '',
        sessionId: null,
        currentRound: 0,
        isLoading: false,
        error: null,
        messages: [],
        fallaciesByRound: {},
        tree: null,
    }),
}))
