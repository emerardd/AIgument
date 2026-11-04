import type { SessionStatus, SessionType } from '@/types'

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
    debate: '对抗辩论',
    dialectic: '辩证推演',
    dual_chat: '角色对话',
    qa_socratic: '问答',
    chat: '旧版对话',
    qa: '旧版问答',
}

/** Completed is the normal state and gets no label. */
export const STATUS_LABELS: Partial<Record<SessionStatus, string>> = {
    running: '进行中',
    failed: '失败',
    cancelled: '已取消',
    interrupted: '已中断',
}

export function formatShortDate(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const now = new Date()
    const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (date.toDateString() === now.toDateString()) return `今天 ${time}`
    const sameYear = date.getFullYear() === now.getFullYear()
    const day = date.toLocaleDateString('zh-CN', sameYear ? { month: 'numeric', day: 'numeric' } : { year: 'numeric', month: 'numeric', day: 'numeric' })
    return `${day} ${time}`
}
