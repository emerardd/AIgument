import { create } from 'zustand'
import type { HistoryItem } from '@/types'
import { historyAPI } from '@/services/api'

interface SessionDetail {
    session_id: number
    type: 'debate' | 'chat' | 'qa'
    messages: Array<{
        role: string
        content: string
        created_at: string
        meta_info?: Record<string, unknown>
    }>
}

interface HistoryState {
    items: HistoryItem[]
    selectedSession: SessionDetail | null
    isLoading: boolean
    isDetailLoading: boolean
    error: string | null
    filter: 'all' | 'debate' | 'chat' | 'qa'

    fetchHistory: () => Promise<void>
    fetchSessionDetail: (id: number) => Promise<void>
    deleteSession: (id: number) => Promise<void>
    setFilter: (filter: 'all' | 'debate' | 'chat' | 'qa') => void
    clearSelectedSession: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
    items: [],
    selectedSession: null,
    isLoading: false,
    isDetailLoading: false,
    error: null,
    filter: 'all',

    fetchHistory: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await historyAPI.getHistory(get().filter)
            set({ items: response.data.history || [], isLoading: false })
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '获取历史记录失败',
                isLoading: false,
            })
        }
    },

    fetchSessionDetail: async (id: number) => {
        set({ isDetailLoading: true, error: null })
        try {
            const response = await historyAPI.getSession(id)
            // 从 items 列表中查找会话类型
            const historyItem = get().items.find(item => item.session_id === id)
            const sessionType = historyItem?.type || 'chat' // 默认为 chat

            set({
                selectedSession: {
                    ...response.data,
                    type: sessionType,
                },
                isDetailLoading: false,
            })
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '获取会话详情失败',
                isDetailLoading: false,
            })
        }
    },

    deleteSession: async (id: number) => {
        try {
            await historyAPI.deleteSession(id)
            // 删除后刷新列表
            await get().fetchHistory()
            // 如果删除的是当前查看的会话，清空详情
            if (get().selectedSession?.session_id === id) {
                set({ selectedSession: null })
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '删除会话失败',
            })
        }
    },

    setFilter: (filter) => {
        set({ filter })
        get().fetchHistory()
    },

    clearSelectedSession: () => set({ selectedSession: null }),
}))
