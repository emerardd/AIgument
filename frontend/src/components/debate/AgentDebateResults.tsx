import { lazy, Suspense } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { VerdictPanel } from './ScorePanel'

const ArgumentGraphView = lazy(() =>
    import('./ArgumentGraphView').then((module) => ({ default: module.ArgumentGraphView }))
)

/** Verdict and argument graph, shown once the jury has decided. */
export function AgentDebateResults() {
    const { verdict, sessionId } = useAgentDebateStore()
    if (!verdict) return null

    return (
        <div className="space-y-12">
            <VerdictPanel id="verdict" verdict={verdict} />
            {sessionId && (
                <Suspense fallback={<p className="t-small text-ink-3">正在生成论点图谱…</p>}>
                    <ArgumentGraphView sessionId={sessionId} />
                </Suspense>
            )}
        </div>
    )
}
