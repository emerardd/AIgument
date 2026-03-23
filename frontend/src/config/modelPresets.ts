import type { Provider } from '@/stores/settingsStore'

export const modelPresets: Record<Provider, string[]> = {
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    openai: ['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.2-pro', 'gpt-5', 'gpt-4.1'],
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'],
    claude: ['claude-opus-4.6', 'claude-sonnet-4.6'],
}
