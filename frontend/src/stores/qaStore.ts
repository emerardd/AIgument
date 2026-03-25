import { create } from 'zustand'

interface QAMessage {
    role: 'user' | 'assistant'
    content: string
}

interface QAState {
    messages: QAMessage[]
    isLoading: boolean
    error: string | null
    sessionId: number | null

    addMessage: (message: QAMessage) => void
    updateLastMessage: (content: string) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    setSessionId: (sessionId: number | null) => void
    clear: () => void
    restoreSession: (messages: QAMessage[], sessionId: number) => void
}

export const useQAStore = create<QAState>((set) => ({
    messages: [],
    isLoading: false,
    error: null,
    sessionId: null,

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
    })),

    updateLastMessage: (content) => set((state) => ({
        messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1 ? { ...msg, content } : msg
        ),
    })),

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setSessionId: (sessionId) => set({ sessionId }),
    clear: () => set({ messages: [], isLoading: false, error: null, sessionId: null }),
    restoreSession: (messages, sessionId) => set({ messages, isLoading: false, error: null, sessionId }),
}))
