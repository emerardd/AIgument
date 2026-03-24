const explicitApiBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

export const API_BASE_URL = explicitApiBase || ''

export function buildApiUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (API_BASE_URL) {
        return `${API_BASE_URL}${normalizedPath}`
    }
    return normalizedPath
}
