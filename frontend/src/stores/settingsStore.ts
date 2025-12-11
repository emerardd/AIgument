import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
    darkMode: boolean
    defaultProvider: 'deepseek' | 'openai'
    defaultModel: string
    streamMode: boolean
    toggleDarkMode: () => void
    setDefaultProvider: (provider: 'deepseek' | 'openai') => void
    setDefaultModel: (model: string) => void
    setStreamMode: (enabled: boolean) => void
    initTheme: () => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            darkMode: false,
            defaultProvider: 'deepseek',
            defaultModel: 'deepseek-chat',
            streamMode: true,

            toggleDarkMode: () =>
                set((state) => {
                    const newMode = !state.darkMode
                    // 更新 DOM
                    if (newMode) {
                        document.documentElement.classList.add('dark')
                    } else {
                        document.documentElement.classList.remove('dark')
                    }
                    return { darkMode: newMode }
                }),

            setDefaultProvider: (provider) => set({ defaultProvider: provider }),
            setDefaultModel: (model) => set({ defaultModel: model }),
            setStreamMode: (enabled) => set({ streamMode: enabled }),

            // 初始化主题 - 在应用启动时调用，同步 DOM 和 store 状态
            initTheme: () => {
                const { darkMode } = get()
                if (darkMode) {
                    document.documentElement.classList.add('dark')
                } else {
                    document.documentElement.classList.remove('dark')
                }
            },
        }),
        {
            name: 'aigument-settings', // localStorage key
            // 在 rehydrate 完成后自动同步主题
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.initTheme()
                }
            },
        }
    )
)

