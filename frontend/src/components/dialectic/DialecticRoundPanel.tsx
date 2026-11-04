import type { DialecticMessage } from '@/stores/dialecticStore'
import type { FallacyItem } from '@/types'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'

interface DialecticRoundPanelProps {
    round: number
    messages: DialecticMessage[]
    fallacies: FallacyItem[]
    showThinking: boolean
    showFallacies: boolean
}

const THINKING_LABELS: Record<string, string> = {
    key_tensions: '主要张力',
    confidence: '把握',
    analysis: '分析',
}

/** Thinking arrives as loose JSON; show its readable parts and skip the rest. */
function ThinkingNotes({ thinking }: { thinking?: Record<string, unknown> }) {
    if (!thinking) return null
    const entries = Object.entries(thinking).flatMap(([key, value]) => {
        if (typeof value === 'string' && value.trim()) return [[key, value] as const]
        if (typeof value === 'number') return [[key, key === 'confidence' ? `${Math.round(value * 100)}%` : String(value)] as const]
        if (Array.isArray(value) && value.length) return [[key, value.filter(v => typeof v === 'string').join('；')] as const]
        return []
    })
    if (entries.length === 0) return null
    return (
        <dl className="mt-3 pt-3 border-t border-line space-y-1.5 text-[0.8125rem]">
            {entries.map(([key, value]) => (
                <div key={key}>
                    <dt className="inline text-ink-3">{THINKING_LABELS[key] ?? key}：</dt>
                    <dd className="inline text-ink-2">{value}</dd>
                </div>
            ))}
        </dl>
    )
}

function FallacyNotes({ items }: { items: FallacyItem[] }) {
    if (items.length === 0) return null
    return (
        <ul className="mt-3 space-y-2">
            {items.map((f, i) => (
                <li key={`${f.type}-${i}`} className="text-[0.8125rem] border-l-2 border-jury pl-3">
                    <span className="text-jury font-medium">{f.type}</span>
                    {f.quote && <span className="text-ink-2 ml-2">“{f.quote}”</span>}
                    {f.explanation && <p className="text-ink-3 mt-0.5">{f.explanation}</p>}
                </li>
            ))}
        </ul>
    )
}

function Position({ kind, message, fallacies, showThinking }: {
    kind: 'thesis' | 'antithesis'
    message?: DialecticMessage
    fallacies: FallacyItem[]
    showThinking: boolean
}) {
    const isThesis = kind === 'thesis'
    const side = isThesis ? 'pro' : 'con'
    return (
        <div className={`relative pl-9 md:pl-0 ${isThesis ? 'md:col-start-1 md:pr-10' : 'md:col-start-3 md:row-start-2 md:pl-10'}`}>
            <span
                className={`stone stone-${side} absolute top-[0.45rem] left-3 -translate-x-1/2 md:translate-x-0 ${isThesis ? 'md:left-auto md:-right-[0.35rem]' : 'md:-left-[0.35rem]'} ring-4 ring-board`}
                aria-hidden="true"
            />
            <div className={`text-[0.8125rem] mb-1.5 font-medium ${isThesis ? 'text-pro md:text-right' : 'text-con'}`}>
                {isThesis ? '正题' : '反题'}
            </div>
            <div className={`bg-surface rounded-md px-5 py-4 text-[0.9375rem] border-l-2 ${isThesis ? 'border-l-pro md:border-l-0 md:border-r-2 md:border-r-pro' : 'border-l-con'}`}>
                {message?.content ? <MarkdownRenderer content={message.content} /> : <p className="text-sm text-ink-3">正在写…</p>}
                {showThinking && <ThinkingNotes thinking={message?.thinking} />}
                <FallacyNotes items={fallacies} />
            </div>
        </div>
    )
}

/** One round on the spine: thesis left, antithesis right, synthesis joins them in the middle. */
export function DialecticRoundPanel({ round, messages, fallacies, showThinking, showFallacies }: DialecticRoundPanelProps) {
    const thesis = messages.find(m => m.role === '正题')
    const antithesis = messages.find(m => m.role === '反题')
    const synthesis = messages.find(m => m.role === '合题')

    return (
        <div className="relative pb-12">
            <div className="relative z-10 flex md:justify-center mb-6">
                <span className="bg-board px-3 py-0.5 rounded-full border border-line-strong text-[0.8125rem] text-ink-2">第 {round} 轮</span>
            </div>

            <div className="grid md:grid-cols-[1fr_0_1fr] gap-y-8">
                <Position kind="thesis" message={thesis} showThinking={showThinking}
                    fallacies={showFallacies ? fallacies.filter(f => f.side === 'thesis') : []} />
                {(antithesis || thesis?.content) && (
                    <Position kind="antithesis" message={antithesis} showThinking={showThinking}
                        fallacies={showFallacies ? fallacies.filter(f => f.side === 'antithesis') : []} />
                )}
            </div>

            {synthesis && (
                <div className="arrive relative z-10 mt-8 pl-9 md:pl-0">
                    <div className="mx-auto max-w-xl panel border-ink px-5 py-4">
                        <div className="flex items-center gap-2 text-[0.8125rem] font-medium mb-2">
                            <span className="stone stone-pro" aria-hidden="true" />
                            <span className="stone stone-con -ml-2.5" aria-hidden="true" />
                            合题
                            <span className="font-normal text-ink-3">成为下一轮的正题</span>
                        </div>
                        <MarkdownRenderer content={synthesis.content} />
                        {showThinking && <ThinkingNotes thinking={synthesis.thinking} />}
                    </div>
                </div>
            )}
        </div>
    )
}
