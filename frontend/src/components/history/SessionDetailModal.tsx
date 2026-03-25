import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useHistoryStore } from '@/stores/historyStore'
import { useChatStore } from '@/stores/chatStore'
import { useQAStore } from '@/stores/qaStore'
import { useToast } from '@/hooks/useToast'
import { downloadSessionExport } from '@/utils/download'
import { X, Loader2, Download, Calendar, MessageCircle } from 'lucide-react'
import type { ChatMessage } from '@/types'

interface SessionDetailModalProps {
    sessionId: number
    isOpen: boolean
    onClose: () => void
}

export function SessionDetailModal({ sessionId, isOpen, onClose }: SessionDetailModalProps) {
    const { selectedSession, isDetailLoading, fetchSessionDetail, clearSelectedSession } = useHistoryStore()
    const { restoreSession: restoreChatSession } = useChatStore()
    const { restoreSession: restoreQASession } = useQAStore()
    const toast = useToast()
    const navigate = useNavigate()

    useEffect(() => {
        if (isOpen && sessionId) {
            fetchSessionDetail(sessionId)
        }
        return () => {
            clearSelectedSession()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, sessionId])

    if (!isOpen) return null

    const handleExport = async (format: 'md' | 'json') => {
        try {
            await downloadSessionExport(sessionId, format)
            toast.success(`导出成功: session_${sessionId}.${format}`)
        } catch {
            toast.error('导出失败，请重试')
        }
    }

    const getRoleColor = (role: string) => {
        const colors: Record<string, string> = {
            正方: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10',
            反方: 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
            正题: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/10',
            反题: 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10',
            合题: 'border-l-violet-500 bg-violet-50 dark:bg-violet-900/10',
            topic: 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10',
            user: 'border-l-green-500 bg-green-50 dark:bg-green-900/10',
            assistant: 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/10',
            小阳: 'border-l-sky-500 bg-sky-50 dark:bg-sky-900/10',
            老陈: 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10',
            阿疑: 'border-l-rose-500 bg-rose-50 dark:bg-rose-900/10',
            小创: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/10',
            老王: 'border-l-stone-500 bg-stone-50 dark:bg-stone-900/10',
            孔思: 'border-l-indigo-500 bg-indigo-50 dark:bg-indigo-900/10',
        }
        return colors[role] || 'border-l-gray-500 bg-gray-50'
    }

    const getRoleLabel = (role: string) => {
        const labels: Record<string, { text: string; emoji: string }> = {
            正方: { text: '正方', emoji: '👍' },
            反方: { text: '反方', emoji: '👎' },
            正题: { text: '正题', emoji: '🧠' },
            反题: { text: '反题', emoji: '⚡' },
            合题: { text: '合题', emoji: '🔺' },
            topic: { text: '主题', emoji: '📌' },
            user: { text: '用户', emoji: '👤' },
            assistant: { text: 'AI', emoji: '🤖' },
            小阳: { text: '小阳', emoji: '🌞' },
            老陈: { text: '老陈', emoji: '📊' },
            阿疑: { text: '阿疑', emoji: '❓' },
            小创: { text: '小创', emoji: '💡' },
            老王: { text: '老王', emoji: '🔧' },
            孔思: { text: '孔思', emoji: '📚' },
        }
        return labels[role] || { text: role, emoji: '💬' }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleString('zh-CN')
    }

    const handleContinueChat = () => {
        if (!selectedSession) return

        const sessionType = selectedSession.type
        const messages = selectedSession.messages

        if (sessionType === 'chat' || sessionType === 'qa') {
            const chatMessages: ChatMessage[] = messages
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .map(msg => ({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content
                }))

            if (sessionType === 'chat') {
                restoreChatSession(chatMessages, selectedSession.session_id)
            } else {
                restoreQASession(chatMessages, selectedSession.session_id)
            }
            onClose()
            navigate(sessionType === 'chat' ? '/chat' : '/qa')
            toast.success('已恢复会话，可以继续对话')
        } else {
            toast.info('当前模式暂不支持继续对话')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 模态框内容 */}
            <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden mx-4">
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold">会话详情</h2>
                    <div className="flex items-center gap-2">
                        {selectedSession && (selectedSession.type === 'chat' || selectedSession.type === 'qa') && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleContinueChat}
                                className="btn-primary gap-1"
                            >
                                <MessageCircle className="h-4 w-4" />
                                继续对话
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleExport('md')}>
                            <Download className="h-4 w-4 mr-1" />
                            MD
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                            <Download className="h-4 w-4 mr-1" />
                            JSON
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="overflow-y-auto p-4 max-h-[calc(85vh-80px)]">
                    {isDetailLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="ml-3 text-gray-500">加载中...</span>
                        </div>
                    ) : selectedSession ? (
                        <div className="space-y-4">
                            {selectedSession.messages.map((msg, idx) => {
                                const roleInfo = getRoleLabel(msg.role)
                                return (
                                    <div
                                        key={idx}
                                        className={`border-l-4 rounded-lg p-4 ${getRoleColor(msg.role)}`}
                                    >
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="font-semibold">
                                                {roleInfo.emoji} {roleInfo.text}
                                            </span>
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(msg.created_at)}
                                            </span>
                                        </div>
                                        <div className="prose dark:prose-invert max-w-none">
                                            <MarkdownRenderer content={msg.content} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-12">
                            未找到会话内容
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
