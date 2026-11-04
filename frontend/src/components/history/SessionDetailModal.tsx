import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useHistoryStore } from '@/stores/historyStore'
import { useToast } from '@/hooks/useToast'
import { downloadSessionExport } from '@/utils/download'
import { SESSION_TYPE_LABELS, STATUS_LABELS, formatShortDate } from '@/utils/sessionLabels'
import type { SocraticRestoreState } from '@/components/qa/SocraticQAView'
import { X } from 'lucide-react'

interface SessionDetailModalProps {
    sessionId: number
    isOpen: boolean
    onClose: () => void
}

const PRO_ROLES = new Set(['正方', '正题'])
const CON_ROLES = new Set(['反方', '反题'])
const ROLE_NAMES: Record<string, string> = { user: '你', assistant: '回答', topic: '话题' }

function roleTone(role: string) {
    if (PRO_ROLES.has(role)) return 'text-pro'
    if (CON_ROLES.has(role)) return 'text-con'
    if (role === 'user') return 'text-ink'
    return 'text-ink-2'
}

export function SessionDetailModal({ sessionId, isOpen, onClose }: SessionDetailModalProps) {
    const { selectedSession, isDetailLoading, fetchSessionDetail, clearSelectedSession } = useHistoryStore()
    const toast = useToast()
    const navigate = useNavigate()
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isOpen && sessionId) fetchSessionDetail(sessionId)
        return () => clearSelectedSession()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, sessionId])

    useEffect(() => {
        if (!isOpen) return
        dialogRef.current?.focus()
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleExport = async (format: 'md' | 'json' | 'txt') => {
        try {
            await downloadSessionExport(sessionId, format)
            toast.success(`已导出 session_${sessionId}.${format}`)
        } catch {
            toast.error('导出失败，请重试')
        }
    }

    const canContinue = selectedSession?.type === 'qa_socratic'

    const handleContinue = () => {
        if (!selectedSession || !canContinue) return
        const state: SocraticRestoreState = {
            restore: {
                sessionId: selectedSession.session_id,
                mode: selectedSession.mode ?? undefined,
                history: selectedSession.messages
                    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                    .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
            },
        }
        onClose()
        navigate('/socratic-qa', { state })
        toast.success('已打开这次问答，可以接着问')
    }

    const status = selectedSession?.status ? STATUS_LABELS[selectedSession.status as keyof typeof STATUS_LABELS] : undefined

    return (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-6">
            <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="session-detail-title"
                tabIndex={-1}
                className="arrive relative bg-board sm:rounded-lg w-full max-w-3xl sm:max-h-[88vh] flex flex-col outline-none shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]"
            >
                <header className="flex items-start gap-4 px-5 sm:px-7 pt-5 pb-4 border-b border-line">
                    <div className="min-w-0 flex-1">
                        <p className="text-[0.8125rem] text-ink-3">
                            {selectedSession ? SESSION_TYPE_LABELS[selectedSession.type] : '会话'}
                            {status && <span className="ml-3 text-ink-2">{status}</span>}
                        </p>
                        <h2 id="session-detail-title" className="display text-[1.5rem] mt-1 break-words">
                            {selectedSession?.topic || (isDetailLoading ? '正在读取…' : '未命名')}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 -mr-2 rounded text-ink-3 hover:text-ink hover:bg-sunken" aria-label="关闭">
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="flex flex-wrap items-center gap-2 px-5 sm:px-7 py-3 border-b border-line">
                    {canContinue && (
                        <button type="button" onClick={handleContinue} className="btn-ink h-9">接着问</button>
                    )}
                    <span className="text-[0.8125rem] text-ink-3 ml-auto mr-1">导出</span>
                    {(['md', 'json', 'txt'] as const).map(f => (
                        <button key={f} type="button" onClick={() => handleExport(f)} className="btn-line h-8 px-2.5 text-[0.8125rem]">
                            {f === 'md' ? 'Markdown' : f.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="overflow-y-auto px-5 sm:px-7 py-5 flex-1">
                    {isDetailLoading ? (
                        <p className="text-sm text-ink-3 py-8">正在读取…</p>
                    ) : selectedSession && selectedSession.messages.length > 0 ? (
                        <ol>
                            {selectedSession.messages.map((msg, idx) => (
                                <li key={idx} className="grid sm:grid-cols-[6rem_1fr] gap-x-5 gap-y-1 py-4 border-b border-line last:border-0">
                                    <div className="text-[0.8125rem]">
                                        <span className={`font-medium ${roleTone(msg.role)}`}>{ROLE_NAMES[msg.role] ?? msg.role}</span>
                                        <span className="block text-ink-3 tabular-nums">{formatShortDate(msg.created_at)}</span>
                                    </div>
                                    <div className={`min-w-0 text-[0.9375rem] ${msg.role === 'user' ? 'font-serif font-semibold text-[1.0625rem]' : ''}`}>
                                        <MarkdownRenderer content={msg.content} />
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-sm text-ink-3 py-8">这次会话没有留下任何内容，可能在开始前就中断了。</p>
                    )}
                </div>
            </div>
        </div>
    )
}
