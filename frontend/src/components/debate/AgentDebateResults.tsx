import { lazy, Suspense } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { exportDebateMarkdown } from '@/utils/exportUtils'
import { VerdictPanel } from './ScorePanel'
import { Download, Loader2 } from 'lucide-react'

const ArgumentGraphView = lazy(() =>
    import('./ArgumentGraphView').then((module) => ({ default: module.ArgumentGraphView }))
)

/** Verdict, argument graph and export, shown once the jury has decided. */
export function AgentDebateResults() {
    const { verdict, sessionId, topic, messages, evaluations, totalRounds } = useAgentDebateStore()
    if (!verdict) return null

    return (
        <>
            <VerdictPanel
                winner={verdict.winner}
                proScore={verdict.pro_total_score}
                conScore={verdict.con_total_score}
                margin={verdict.margin}
                summary={verdict.summary}
                proStrengths={verdict.pro_strengths}
                conStrengths={verdict.con_strengths}
                keyTurningPoints={verdict.key_turning_points}
            />

            {sessionId && (
                <div className="mt-8 animate-fade-in">
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    }>
                        <ArgumentGraphView sessionId={sessionId} />
                    </Suspense>
                </div>
            )}

            <div className="flex justify-center mt-4 animate-fade-in">
                <button
                    onClick={() => exportDebateMarkdown({ topic, messages, evaluations, verdict, totalRounds })}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 transition-all duration-300"
                >
                    <Download className="w-4 h-4" />
                    导出 Markdown
                </button>
            </div>
        </>
    )
}
