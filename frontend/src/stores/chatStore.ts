import { create } from 'zustand'
import type { ChatMessage } from '@/types'

interface ChatState {
    messages: ChatMessage[]
    isLoading: boolean
    error: string | null

    addMessage: (message: ChatMessage) => void
    updateLastMessage: (content: string) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    clear: () => void
    restoreMessages: (messages: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    isLoading: false,
    error: null,

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    updateLastMessage: (content) => set((state) => ({
        messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1 ? { ...msg, content } : msg
        )
    })),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    clear: () => set({ messages: [], error: null }),
    restoreMessages: (messages) => set({ messages, error: null }),
}))

