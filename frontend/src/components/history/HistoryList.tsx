import { useEffect, useState } from 'react'
import { useHistoryStore } from '@/stores/historyStore'
import { useToast } from '@/hooks/useToast'
import { HistoryListSkeleton } from '@/components/ui/Skeleton'
import { downloadSessionExport } from '@/utils/download'
import { SESSION_TYPE_LABELS, STATUS_LABELS, formatShortDate } from '@/utils/sessionLabels'
import type { SessionType } from '@/types'
import { Download, Search, Trash2, X } from 'lucide-react'

const FILTERS: { id: SessionType | 'all'; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'debate', label: '对抗辩论' },
    { id: 'dialectic', label: '辩证推演' },
    { id: 'dual_chat', label: '角色对话' },
    { id: 'qa_socratic', label: '问答' },
    { id: 'chat', label: '旧版对话' },
    { id: 'qa', label: '旧版问答' },
]

interface HistoryListProps {
    onViewDetail: (id: number) => void
}

export function HistoryList({ onViewDetail }: HistoryListProps) {
    const {
        items, total, hasMore, isLoading, isLoadingMore, error, filter, searchQuery,
        fetchHistory, loadMore, deleteSession, setFilter, setSearchQuery,
    } = useHistoryStore()
    const toast = useToast()
    const [searchText, setSearchText] = useState(searchQuery)

    useEffect(() => {
        fetchHistory()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleExport = async (id: number) => {
        try {
            await downloadSessionExport(id, 'md')
            toast.success(`已导出 session_${id}.md`)
        } catch {
            toast.error('导出失败，请重试')
        }
    }

    const handleDelete = async (id: number, topic: string) => {
        if (!confirm(`删除“${topic || '未命名'}”？删除后不能恢复。`)) return
        await deleteSession(id)
        toast.success('已删除')
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="按类型筛选">
                    {FILTERS.map(f => (
                        <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                            {f.label}
                        </button>
                    ))}
                </div>

                <form
                    onSubmit={(e) => { e.preventDefault(); setSearchQuery(searchText) }}
                    className="field flex items-center gap-2 pl-3 pr-1 h-9 w-full sm:w-64"
                    role="search"
                >
                    <Search className="h-4 w-4 text-ink-3 shrink-0" aria-hidden="true" />
                    <input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="搜索话题"
                        aria-label="搜索话题"
                        className="flex-1 min-w-0 text-sm placeholder:text-ink-3"
                    />
                    {searchText && (
                        <button
                            type="button"
                            onClick={() => { setSearchText(''); setSearchQuery('') }}
                            className="p-1 text-ink-3 hover:text-ink"
                            aria-label="清除搜索"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </form>
            </div>

            {isLoading ? (
                <HistoryListSkeleton />
            ) : error ? (
                <div className="panel px-5 py-4 t-small" style={{ boxShadow: 'inset 3px 0 0 var(--danger), var(--shadow-card)' }} role="alert">
                    历史记录读取失败：{error}
                </div>
            ) : items.length === 0 ? (
                <p className="panel px-6 py-10 text-ink-2">
                    {searchQuery ? `没有话题包含“${searchQuery}”。` : '这里还是空的。完成一次辩论、对话或问答后会出现在这里。'}
                </p>
            ) : (
                <>
                    <ul className="panel divide-y divide-line px-5">
                        {items.map((item) => {
                            const status = item.status ? STATUS_LABELS[item.status] : undefined
                            return (
                                <li key={item.session_id} className="group grid grid-cols-[1fr_auto] sm:grid-cols-[6.5rem_1fr_auto_auto] items-baseline gap-x-4 gap-y-1 py-3.5">
                                    <span className="hidden sm:block text-[0.8125rem] text-ink-3">{SESSION_TYPE_LABELS[item.type] ?? item.type}</span>
                                    <button
                                        type="button"
                                        onClick={() => onViewDetail(item.session_id)}
                                        className="min-w-0 text-left hover:underline underline-offset-4 decoration-line-strong"
                                    >
                                        <span className="block truncate">{item.topic || '未命名'}</span>
                                        <span className="sm:hidden block text-[0.8125rem] text-ink-3 mt-0.5">
                                            {SESSION_TYPE_LABELS[item.type] ?? item.type}，{item.message_count} 条
                                        </span>
                                    </button>
                                    <span className="hidden sm:flex items-baseline gap-4 text-[0.8125rem] text-ink-3 tabular-nums">
                                        {status && <span className={item.status === 'failed' ? 'text-destructive' : 'text-ink-2'}>{status}</span>}
                                        <span>{item.message_count} 条</span>
                                        <time dateTime={item.start_time}>{formatShortDate(item.start_time)}</time>
                                    </span>
                                    <span className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                                        {status && <span className="sm:hidden text-[0.8125rem] text-ink-2 mr-2">{status}</span>}
                                        <button
                                            type="button"
                                            onClick={() => handleExport(item.session_id)}
                                            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-sunken"
                                            title="导出为 Markdown"
                                            aria-label={`导出“${item.topic}”`}
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item.session_id, item.topic)}
                                            className="p-1.5 rounded text-ink-3 hover:text-destructive hover:bg-sunken"
                                            title="删除"
                                            aria-label={`删除“${item.topic}”`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                    <div className="flex items-center justify-between pt-4 text-[0.8125rem] text-ink-3">
                        <span>{items.length} / {total} 条</span>
                        {hasMore && (
                            <button type="button" onClick={loadMore} disabled={isLoadingMore} className="btn-line">
                                {isLoadingMore ? '加载中…' : '加载更多'}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
