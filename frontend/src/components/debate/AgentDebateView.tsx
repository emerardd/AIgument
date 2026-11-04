import { useCallback, useRef } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { useAgentDebateRun } from '@/features/debate/useAgentDebateRun'
import { exportDebateMarkdown } from '@/utils/exportUtils'
import { AgentDebateForm } from './AgentDebateForm'
import { AgentDebateTranscript, DebateRail } from './AgentDebateTranscript'
import { AgentDebateResults } from './AgentDebateResults'
import { ScoreBoard } from './ScorePanel'
import { Download, RotateCcw, Square } from 'lucide-react'

function SidePanel({ onCancel }: { onCancel: () => void }) {
    const {
        isLoading, evaluations, verdict, models, topic, messages, totalRounds,
        showThinking, showScores, toggleShowThinking, toggleShowScores, reset,
    } = useAgentDebateStore()

    return (
        <aside className="space-y-4 lg:sticky lg:top-24 self-start" aria-label="辩论信息">
            <div className="panel px-5 py-5">
                <ScoreBoard evaluations={evaluations} verdict={verdict} />
            </div>

            <div className="panel px-5 py-4 space-y-4">
                <dl className="space-y-2 t-small">
                    <div className="flex items-baseline gap-2">
                        <span className="stone stone-pro self-center" aria-hidden="true" />
                        <dt className="text-ink-3 shrink-0">正方</dt>
                        <dd className="ml-auto text-ink-2 truncate">{models?.pro}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="stone stone-con self-center" aria-hidden="true" />
                        <dt className="text-ink-3 shrink-0">反方</dt>
                        <dd className="ml-auto text-ink-2 truncate">{models?.con}</dd>
                    </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className="chip" aria-pressed={showThinking} onClick={toggleShowThinking}>思路</button>
                    <button type="button" className="chip" aria-pressed={showScores} onClick={toggleShowScores}>评分</button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {isLoading ? (
                    <button type="button" onClick={onCancel} className="btn-ink w-full">
                        <Square className="h-3.5 w-3.5" fill="currentColor" />停止辩论
                    </button>
                ) : (
                    <button type="button" onClick={reset} className="btn-ink w-full">
                        <RotateCcw className="h-4 w-4" />换个辩题
                    </button>
                )}
                {verdict && (
                    <button
                        type="button"
                        onClick={() => exportDebateMarkdown({ topic, messages, evaluations, verdict, totalRounds })}
                        className="btn-line w-full"
                    >
                        <Download className="h-4 w-4" />导出为 Markdown
                    </button>
                )}
            </div>
        </aside>
    )
}

export function AgentDebateView() {
    const endRef = useRef<HTMLDivElement>(null)
    const { isLoading, error, messages, topic, totalRounds } = useAgentDebateStore()

    const scrollToEnd = useCallback(() => {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)
    }, [])
    const { start, cancel } = useAgentDebateRun(scrollToEnd)

    if (!topic) {
        return (
            <div className="panel px-5 sm:px-8 py-6 sm:py-8 max-w-[760px]">
                <AgentDebateForm isLoading={isLoading} onStart={start} onCancel={cancel} />
            </div>
        )
    }

    return (
        <div>
            <header className="mb-5">
                <p className="t-meta">{totalRounds} 轮对抗辩论</p>
                <h2 className="display text-[1.75rem] sm:text-[2.5rem] mt-1 max-w-[48rem]">{topic}</h2>
            </header>

            <div className="sticky top-[60px] md:top-0 z-20 -mx-[clamp(16px,4vw,56px)] px-[clamp(16px,4vw,56px)] py-3 bg-page/90 backdrop-blur-md border-b border-line">
                <DebateRail />
            </div>

            <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_288px] gap-8 lg:gap-10 items-start">
                <div className="min-w-0 space-y-14">
                    {error && (
                        <div className="panel px-5 py-4 text-sm" style={{ boxShadow: 'inset 3px 0 0 var(--danger), var(--shadow-card)' }} role="alert">
                            {error}
                        </div>
                    )}
                    {isLoading && messages.length === 0 && <p className="text-ink-3 streaming" role="status">双方正在审题</p>}
                    <AgentDebateTranscript />
                    <AgentDebateResults />
                    <div ref={endRef} />
                </div>
                <SidePanel onCancel={cancel} />
            </div>
        </div>
    )
}
