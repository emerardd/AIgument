import type { Provider } from '@/stores/settingsStore'

export const modelPresets: Record<Provider, string[]> = {
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    openai: ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    gemini: ['gemini-3.1-pro', 'gemini-3-flash', 'gemini-3.1-flash-lite'],
    claude: ['claude-opus-4.6', 'claude-sonnet-4.6'],
}
