import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useHistoryStore } from '@/stores/historyStore'
import { useChatStore } from '@/stores/chatStore'
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
    const { restoreMessages } = useChatStore()
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
            // 将消息转换为 ChatMessage 格式
            const chatMessages: ChatMessage[] = messages
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .map(msg => ({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content
                }))

            restoreMessages(chatMessages)
            onClose()
            navigate(sessionType === 'chat' ? '/chat' : '/qa')
            toast.success('已恢复会话，可以继续对话')
        } else {
            toast.info('辩论模式暂不支持继续对话')
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
