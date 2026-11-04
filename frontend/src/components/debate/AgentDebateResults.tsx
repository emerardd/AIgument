import { lazy, Suspense } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { exportDebateMarkdown } from '@/utils/exportUtils'
import { VerdictPanel } from './ScorePanel'
import { Download } from 'lucide-react'

const ArgumentGraphView = lazy(() =>
    import('./ArgumentGraphView').then((module) => ({ default: module.ArgumentGraphView }))
)

/** Verdict, argument graph and export, shown once the jury has decided. */
export function AgentDebateResults() {
    const { verdict, sessionId, topic, messages, evaluations, totalRounds } = useAgentDebateStore()
    if (!verdict) return null

    return (
        <div className="space-y-12">
            <VerdictPanel verdict={verdict} />

            <div className="flex justify-center">
                <button
                    type="button"
                    onClick={() => exportDebateMarkdown({ topic, messages, evaluations, verdict, totalRounds })}
                    className="btn-line"
                >
                    <Download className="w-4 h-4" />
                    导出为 Markdown
                </button>
            </div>

            {sessionId && (
                <Suspense fallback={<p className="text-sm text-ink-3 text-center">正在生成论点图谱…</p>}>
                    <ArgumentGraphView sessionId={sessionId} />
                </Suspense>
            )}
        </div>
    )
}
