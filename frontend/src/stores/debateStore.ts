import { create } from 'zustand'
import type { DebateMessage } from '@/types'
import { createSessionState } from './sessionStore'

interface DebateState {
    messages: DebateMessage[]
    isLoading: boolean
    error: string | null
    topic: string
    addMessage: (message: DebateMessage) => void
    updateMessage: (index: number, content: string) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    setTopic: (topic: string) => void
    clear: () => void
}

export const useDebateStore = create<DebateState>((set) => ({
    ...createSessionState<DebateMessage>(),
    topic: '',

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    updateMessage: (index, content) => set((state) => ({
        messages: state.messages.map((msg, idx) =>
            idx === index ? { ...msg, content } : msg
        )
    })),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setTopic: (topic) => set({ topic }),
    clear: () => set({ messages: [], error: null, topic: '' }),
}))
