import type { DialecticMessage } from '@/stores/dialecticStore'
import type { FallacyItem } from '@/types'
import { Utterance } from '@/components/session/Utterance'
import type { TurnState } from '@/components/session/TurnRail'
import { dialecticTurnId } from '@/features/dialectic/turnIds'


interface DialecticRoundPanelProps {
    round: number
    messages: DialecticMessage[]
    fallacies: FallacyItem[]
    states: Record<'thesis' | 'antithesis' | 'synthesis', TurnState>
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
        <dl className="mt-4 pt-3 border-t border-line space-y-1.5 t-small">
            {entries.map(([key, value]) => (
                <div key={key}>
                    <dt className="inline text-ink-3">{THINKING_LABELS[key] ?? key}：</dt>
                    <dd className="inline text-ink-2">{value}</dd>
                </div>
            ))}
        </dl>
    )
}

/** Fallacies are the observer's notes on a speech, so they carry the judge's gold. */
function FallacyNotes({ items }: { items: FallacyItem[] }) {
    if (items.length === 0) return null
    return (
        <ul className="mt-4 pt-3 border-t border-line space-y-2.5">
            {items.map((f, i) => (
                <li key={`${f.type}-${i}`} className="t-small">
                    <span className="inline-flex items-center gap-1.5 text-jury font-medium">
                        <span className="stone stone-jury" aria-hidden="true" />{f.type}
                    </span>
                    {f.quote && <span className="text-ink-2 ml-2">“{f.quote}”</span>}
                    {f.explanation && <p className="text-ink-3 mt-0.5">{f.explanation}</p>}
                </li>
            ))}
        </ul>
    )
}

/** One round: thesis, antithesis, then the observer's synthesis, which becomes the next thesis. */
export function DialecticRoundPanel({ round, messages, fallacies, states, showThinking, showFallacies }: DialecticRoundPanelProps) {
    const thesis = messages.find(m => m.role === '正题')
    const antithesis = messages.find(m => m.role === '反题')
    const synthesis = messages.find(m => m.role === '合题')
    const notes = (side: 'thesis' | 'antithesis') => (showFallacies ? fallacies.filter(f => f.side === side) : [])

    return (
        <section aria-label={`第 ${round} 轮`} className="space-y-6">
            <h2 className="flex items-center gap-3">
                <span className="numeral text-[1.25rem] text-ink-2">{round}</span>
                <span className="t-meta">第 {round} 轮</span>
                <span className="flex-1 h-px bg-line" aria-hidden="true" />
            </h2>

            <Utterance
                id={dialecticTurnId(round, 'thesis')}
                voice="a"
                speaker="正题"
                content={thesis?.content}
                streaming={states.thesis === 'live'}
                after={<>{showThinking && <ThinkingNotes thinking={thesis?.thinking} />}<FallacyNotes items={notes('thesis')} /></>}
            />

            {(antithesis || states.antithesis !== 'pending') && (
                <Utterance
                    id={dialecticTurnId(round, 'antithesis')}
                    voice="b"
                    speaker="反题"
                    align="end"
                    content={antithesis?.content}
                    streaming={states.antithesis === 'live'}
                    after={<>{showThinking && <ThinkingNotes thinking={antithesis?.thinking} />}<FallacyNotes items={notes('antithesis')} /></>}
                />
            )}

            {(synthesis || states.synthesis !== 'pending') && (
                <div className="sm:px-[6%]">
                    <Utterance
                        align="center"
                        id={dialecticTurnId(round, 'synthesis')}
                        voice="judge"
                        speaker="合题"
                        meta="成为下一轮的正题"
                        content={synthesis?.content}
                        streaming={states.synthesis === 'live'}
                        after={showThinking ? <ThinkingNotes thinking={synthesis?.thinking} /> : null}
                    />
                </div>
            )}
        </section>
    )
}
