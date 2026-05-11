export type Provider = 'deepseek' | 'openai' | 'gemini' | 'claude' | 'mock'

export const modelPresets: Record<Provider, string[]> = {
    deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    openai: ['gpt-5.5'],
    gemini: ['gemini-3.1-pro', 'gemini-3-flash', 'gemini-3.1-flash-lite'],
    claude: ['claude-opus-4.7'],
    mock: ['mock'],
}
