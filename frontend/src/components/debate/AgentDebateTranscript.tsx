import { lazy, Suspense } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import type { AgentDebateMessage } from '@/stores/agentDebateStore'
import type { AgentThinking } from '@/types'
import { CopyButton } from '@/components/ui/CopyButton'
import { ThinkingBubble } from './ThinkingBubble'
import { LiveScore, RoundRuling } from './ScorePanel'

const MarkdownRenderer = lazy(() =>
    import('@/components/ui/MarkdownRenderer').then((module) => ({ default: module.MarkdownRenderer }))
)

/*
 * The board: a vertical spine down the middle (left edge on phones).
 * 正方 moves sit left of it, 反方 moves right of it, one row per move,
 * and each round's ruling is laid across the spine.
 */

function Speech({ side, message, thinking, showThinking }: {
    side: 'pro' | 'con'
    message?: AgentDebateMessage
    thinking?: AgentThinking
    showThinking: boolean
}) {
    const isPro = side === 'pro'
    const column = isPro ? 'md:col-start-1 md:pr-10' : 'md:col-start-3 md:row-start-2 md:pl-10'
    const edge = isPro ? 'md:border-l-0 md:border-r-2 md:border-r-pro border-l-2 border-l-pro' : 'border-l-2 border-l-con'

    return (
        <div className={`relative pl-9 md:pl-0 ${column}`}>
            {/* the stone on the spine */}
            <span
                className={`stone stone-${side} absolute top-[0.45rem] left-3 -translate-x-1/2 md:translate-x-0 ${isPro ? 'md:left-auto md:-right-[0.35rem]' : 'md:-left-[0.35rem]'} ring-4 ring-board`}
                aria-hidden="true"
            />
            <div className={`text-[0.8125rem] mb-1.5 flex items-center gap-2 ${isPro ? 'md:justify-end' : ''}`}>
                <span className={isPro ? 'text-pro font-medium' : 'text-con font-medium'}>{isPro ? '正方' : '反方'}</span>
            </div>

            {showThinking && thinking && (
                <div className={`mb-2 ${isPro ? 'md:flex md:justify-end' : ''}`}>
                    <ThinkingBubble thinking={thinking} />
                </div>
            )}

            <div className={`group relative bg-surface rounded-md px-5 py-4 text-[0.9375rem] ${edge}`}>
                {message?.content ? (
                    <>
                        <Suspense fallback={<p className="whitespace-pre-wrap">{message.content}</p>}>
                            <MarkdownRenderer content={message.content} />
                        </Suspense>
                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <CopyButton text={message.content} />
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-ink-3">正在组织发言…</p>
                )}
            </div>
        </div>
    )
}

export function AgentDebateTranscript() {
    const {
        topic, messages, thinkings, evaluations, standings, currentRound,
        showThinking, showScores, isLoading,
    } = useAgentDebateStore()

    if (!topic) return null
    const rounds = Array.from({ length: Math.max(currentRound, 1) }, (_, i) => i + 1)

    return (
        <section aria-label="辩论过程">
            <div className="sticky top-[57px] md:top-0 z-20 bg-board/95 backdrop-blur-[2px] border-b border-line py-3 mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <span className="flex items-center gap-2 text-sm"><span className="stone stone-pro" aria-hidden="true" />正方</span>
                {standings && isLoading ? <LiveScore standings={standings} /> : <span />}
                <span className="flex items-center justify-end gap-2 text-sm">反方<span className="stone stone-con" aria-hidden="true" /></span>
            </div>

            <h2 className="display text-[1.5rem] sm:text-[1.875rem] text-center max-w-[32rem] mx-auto mb-10">{topic}</h2>

            <div className="relative">
                <div className="absolute top-0 bottom-0 left-3 md:left-1/2 w-px bg-line-strong md:-translate-x-1/2" aria-hidden="true" />

                {rounds.map((round) => {
                    const pro = messages.find(m => m.round === round && m.role === '正方')
                    const con = messages.find(m => m.round === round && m.role === '反方')
                    const proThinking = thinkings.find(t => t.round === round && t.side === 'pro')
                    const conThinking = thinkings.find(t => t.round === round && t.side === 'con')
                    const ruling = evaluations.find(e => e.round === round)
                    if (round > currentRound && !pro && !con && !proThinking) return null

                    return (
                        <div key={round} className="relative pb-12">
                            <div className="relative z-10 flex md:justify-center mb-6">
                                <span className="bg-board px-3 py-0.5 rounded-full border border-line-strong text-[0.8125rem] text-ink-2">
                                    第 {round} 轮
                                </span>
                            </div>

                            <div className="grid md:grid-cols-[1fr_0_1fr] gap-y-8">
                                {(pro || proThinking) && (
                                    <Speech side="pro" message={pro} thinking={proThinking} showThinking={showThinking} />
                                )}
                                {(con || conThinking) && (
                                    <Speech side="con" message={con} thinking={conThinking} showThinking={showThinking} />
                                )}
                            </div>

                            {showScores && ruling && (
                                <div className="mt-8 pl-9 md:pl-0">
                                    <RoundRuling evaluation={ruling} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
