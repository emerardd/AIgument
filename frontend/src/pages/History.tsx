import { useState } from 'react'
import { Page } from '@/components/layout/Page'
import { HistoryList } from '@/components/history/HistoryList'
import { SessionDetailModal } from '@/components/history/SessionDetailModal'
import { StatsPanel } from '@/components/history/StatsPanel'

export default function History() {
    const [selectedId, setSelectedId] = useState<number | null>(null)

    return (
        <Page title="历史" description="所有辩论、对话和问答都保存在本机。点话题查看全文，也可以导出或删除。">
            <StatsPanel />
            <HistoryList onViewDetail={(id) => setSelectedId(id)} />
            <SessionDetailModal
                sessionId={selectedId || 0}
                isOpen={selectedId !== null}
                onClose={() => setSelectedId(null)}
            />
        </Page>
    )
}
