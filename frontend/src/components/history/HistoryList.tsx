import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useHistoryStore } from '@/stores/historyStore'
import { useToast } from '@/hooks/useToast'
import { HistoryListSkeleton } from '@/components/ui/Skeleton'
import { downloadSessionExport } from '@/utils/download'
import { Trash2, Eye, Download, Calendar, MessageSquare } from 'lucide-react'

interface HistoryListProps {
    onViewDetail: (id: number) => void
}

export function HistoryList({ onViewDetail }: HistoryListProps) {
    const { items, isLoading, error, filter, fetchHistory, deleteSession, setFilter } = useHistoryStore()
    const toast = useToast()

    useEffect(() => {
        fetchHistory()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleExport = async (id: number, format: 'md' | 'json') => {
        try {
            await downloadSessionExport(id, format)
            toast.success(`导出成功: session_${id}.${format}`)
        } catch {
            toast.error('导出失败，请重试')
        }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const getTypeLabel = (type: string) => {
        const labels: Record<string, { text: string; color: string }> = {
            debate: { text: '辩论', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
            dialectic: { text: '辩证法', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
            chat: { text: '对话', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
            qa: { text: '问答', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
        }
        return labels[type] || { text: type, color: 'bg-gray-100 text-gray-700' }
    }

    if (isLoading) {
        return <HistoryListSkeleton />
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                错误：{error}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 过滤器 */}
            <div className="flex gap-2 flex-wrap">
                {(['all', 'debate', 'dialectic', 'chat', 'qa'] as const).map((f) => (
                    <Button
                        key={f}
                        variant={filter === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(f)}
                        className={filter === f ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : ''}
                    >
                        {f === 'all'
                            ? '全部'
                            : f === 'debate'
                                ? '辩论'
                                : f === 'dialectic'
                                    ? '辩证法'
                                    : f === 'chat'
                                        ? '对话'
                                        : '问答'}
                    </Button>
                ))}
            </div>

            {/* 列表 */}
            {items.length === 0 ? (
                <Card className="p-8 text-center">
                    <div className="text-gray-400">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>暂无历史记录</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => {
                        const typeInfo = getTypeLabel(item.type)
                        return (
                            <Card
                                key={item.session_id}
                                className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500"
                            >
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                                                    {typeInfo.text}
                                                </span>
                                                <h3 className="font-semibold text-lg truncate">
                                                    {item.topic || '未命名会话'}
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(item.start_time)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MessageSquare className="h-3 w-3" />
                                                    {item.message_count} 条消息
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onViewDetail(item.session_id)}
                                                title="查看详情"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleExport(item.session_id, 'md')}
                                                title="导出为 Markdown"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={async () => {
                                                    if (confirm('确定要删除这条记录吗？')) {
                                                        await deleteSession(item.session_id)
                                                        toast.success('删除成功')
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="删除"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
