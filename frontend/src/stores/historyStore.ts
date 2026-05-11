import { create } from 'zustand'
import type { HistoryItem } from '@/types'
import type { SessionType } from '@/types'
import { historyAPI } from '@/services/api'

const HISTORY_PAGE_SIZE = 20
type HistoryFilter = SessionType | 'all'

interface SessionDetail {
    session_id: number
    type: 'debate' | 'dialectic' | 'chat' | 'qa' | 'dual_chat' | 'qa_socratic'
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
    isLoadingMore: boolean
    isDetailLoading: boolean
    error: string | null
    filter: HistoryFilter
    searchQuery: string
    total: number
    hasMore: boolean
    limit: number
    offset: number

    fetchHistory: () => Promise<void>
    loadMore: () => Promise<void>
    fetchSessionDetail: (id: number) => Promise<void>
    deleteSession: (id: number) => Promise<void>
    setFilter: (filter: HistoryFilter) => void
    setSearchQuery: (query: string) => void
    clearSelectedSession: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
    items: [],
    selectedSession: null,
    isLoading: false,
    isLoadingMore: false,
    isDetailLoading: false,
    error: null,
    filter: 'all',
    searchQuery: '',
    total: 0,
    hasMore: false,
    limit: HISTORY_PAGE_SIZE,
    offset: 0,

    fetchHistory: async () => {
        const { filter, limit, searchQuery } = get()
        set({ isLoading: true, error: null, offset: 0, hasMore: false })
        try {
            const response = await historyAPI.getHistory(filter, limit, 0, searchQuery)
            const history = response.data.history || []
            set({
                items: history,
                total: response.data.total,
                hasMore: response.data.has_more,
                offset: history.length,
                isLoading: false,
            })
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '获取历史记录失败',
                isLoading: false,
            })
        }
    },

    loadMore: async () => {
        const { filter, limit, offset, hasMore, isLoadingMore, searchQuery } = get()
        if (!hasMore || isLoadingMore) return

        set({ isLoadingMore: true, error: null })
        try {
            const response = await historyAPI.getHistory(filter, limit, offset, searchQuery)
            const history = response.data.history || []
            set((state) => ({
                items: [...state.items, ...history],
                total: response.data.total,
                hasMore: response.data.has_more,
                offset: offset + history.length,
                isLoadingMore: false,
            }))
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '加载更多历史记录失败',
                isLoadingMore: false,
            })
        }
    },

    fetchSessionDetail: async (id: number) => {
        set({ isDetailLoading: true, error: null })
        try {
            const response = await historyAPI.getSession(id)
            set({
                selectedSession: response.data,
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
        set({ filter, items: [], total: 0, offset: 0, hasMore: false })
        get().fetchHistory()
    },

    setSearchQuery: (searchQuery) => {
        set({ searchQuery, items: [], total: 0, offset: 0, hasMore: false })
        get().fetchHistory()
    },

    clearSelectedSession: () => set({ selectedSession: null }),
}))
