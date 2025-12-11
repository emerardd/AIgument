import { useState } from 'react'
import { HistoryList } from '@/components/history/HistoryList'
import { SessionDetailModal } from '@/components/history/SessionDetailModal'
import { History as HistoryIcon, Clock } from 'lucide-react'

export default function History() {
    const [selectedId, setSelectedId] = useState<number | null>(null)

    return (
        <div className="min-h-screen py-8">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* 页面标题 */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
                        <HistoryIcon className="h-8 w-8 text-blue-500" />
                        历史记录
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        查看和管理您的辩论、对话记录
                    </p>
                </div>

                {/* 历史列表 */}
                <HistoryList onViewDetail={(id) => setSelectedId(id)} />

                {/* 详情模态框 */}
                <SessionDetailModal
                    sessionId={selectedId || 0}
                    isOpen={selectedId !== null}
                    onClose={() => setSelectedId(null)}
                />
            </div>
        </div>
    )
}
