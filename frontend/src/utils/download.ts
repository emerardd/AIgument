import { API_BASE_URL } from '@/config/env'

type ExportFormat = 'md' | 'json'

export async function downloadSessionExport(sessionId: number, format: ExportFormat): Promise<void> {
    const exportFormat = format === 'md' ? 'markdown' : 'json'
    const response = await fetch(`${API_BASE_URL}/api/history/${sessionId}/export?format=${exportFormat}`)

    if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`)
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `session_${sessionId}.${format}`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(url)
}
