import { lazy, Suspense } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import type { AgentDebateMessage } from '@/stores/agentDebateStore'
import { CopyButton } from '@/components/ui/CopyButton'
import { ThinkingBubble } from './ThinkingBubble'
import { EvaluationPanel } from './ScorePanel'
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react'

const MarkdownRenderer = lazy(() =>
    import('@/components/ui/MarkdownRenderer').then((module) => ({ default: module.MarkdownRenderer }))
)

function ArgumentBubble({ message }: { message: AgentDebateMessage }) {
    const isPro = message.role === '正方'
    return (
        <div className={`flex gap-2 sm:gap-4 animate-slide-up ${isPro ? '' : 'flex-row-reverse'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${isPro
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}
            >
                {isPro ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
            </div>

            <div className={`max-w-[90%] sm:max-w-[85%] space-y-2 ${isPro ? 'items-start' : 'items-end flex flex-col'}`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{message.role}</span>
                    {message.confidence !== undefined && (
                        <>
                            <span>·</span>
                            <span className="text-primary">置信度 {Math.round(message.confidence * 100)}%</span>
                        </>
                    )}
                </div>

                <div className={`relative group card-modern p-5 text-sm leading-relaxed shadow-sm hover:shadow-md transition-shadow duration-300 ${isPro
                    ? 'rounded-tl-none border-l-2 border-l-blue-500'
                    : 'rounded-tr-none border-r-2 border-r-orange-500'}`}
                >
                    {message.content ? (
                        <>
                            <Suspense fallback={<p className="whitespace-pre-wrap">{message.content}</p>}>
                                <MarkdownRenderer content={message.content} />
                            </Suspense>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <CopyButton text={message.content} />
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>正在发言...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Debate content grouped by round: thinking, arguments and the round's evaluation. */
export function AgentDebateTranscript() {
    const { messages, thinkings, evaluations, currentRound, showThinking, showScores } = useAgentDebateStore()
    const rounds = Array.from({ length: Math.max(currentRound, 1) }, (_, i) => i + 1)

    return (
        <>
            {rounds.map((round) => {
                const roundMessages = messages.filter(msg => msg.round === round)
                const roundThinkings = thinkings.filter(t => t.round === round)
                const roundEvaluation = evaluations.find(e => e.round === round)
                // Before the first round starts there is nothing to show.
                if (round > currentRound && roundMessages.length === 0 && roundThinkings.length === 0) return null

                return (
                    <div key={round} className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-sm font-medium text-muted-foreground px-3 py-1 rounded-full bg-muted/30">
                                第 {round} 轮
                            </span>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        {showThinking && roundThinkings.length > 0 && (
                            <div className="space-y-2">
                                {roundThinkings.map((thinking, idx) => (
                                    <ThinkingBubble key={idx} thinking={thinking} />
                                ))}
                            </div>
                        )}

                        {roundMessages.map((msg, idx) => <ArgumentBubble key={idx} message={msg} />)}

                        {showScores && roundEvaluation && <EvaluationPanel evaluation={roundEvaluation} />}
                    </div>
                )
            })}
        </>
    )
}
