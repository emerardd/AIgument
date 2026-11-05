import { useState } from 'react'
import type { FinalVerdict, RoundEvaluation, RoundScore } from '@/types'
import { ChevronDown } from 'lucide-react'

const DIMENSIONS: { key: keyof RoundScore; label: string }[] = [
    { key: 'logic', label: '逻辑' },
    { key: 'evidence', label: '论据' },
    { key: 'rhetoric', label: '表达' },
    { key: 'rebuttal', label: '反驳' },
]

const roundTotal = (score: RoundScore) => score.logic + score.evidence + score.rhetoric + score.rebuttal

const WINNER_TEXT = { pro: '正方', con: '反方', tie: '平' } as const

function DimensionRow({ label, pro, con }: { label: string; pro: number; con: number }) {
    return (
        <div className="grid grid-cols-[1.75rem_1fr_2.5rem_1fr_1.75rem] items-center gap-2 t-small">
            <span className="text-right tabular-nums text-ink-2">{pro}</span>
            <div className="h-1.5 bg-sunken rounded-full overflow-hidden flex justify-end">
                <div className="h-full bg-pro rounded-full" style={{ width: `${pro * 10}%` }} />
            </div>
            <span className="text-center text-ink-3">{label}</span>
            <div className="h-1.5 bg-sunken rounded-full overflow-hidden">
                <div className="h-full bg-con rounded-full" style={{ width: `${con * 10}%` }} />
            </div>
            <span className="tabular-nums text-ink-2">{con}</span>
        </div>
    )
}

/** The jury's turn at the end of a round. Gold marks it as the judge speaking. */
export function RoundRuling({ id, evaluation }: { id?: string; evaluation: RoundEvaluation }) {
    const [open, setOpen] = useState(false)
    const pro = roundTotal(evaluation.pro_score)
    const con = roundTotal(evaluation.con_score)
    const winner = evaluation.round_winner

    return (
        <article
            id={id}
            className="scroll-mt-40 arrive panel px-5 sm:px-6 py-4 mx-auto w-full sm:w-[88%]"
            style={{ boxShadow: 'inset 0 3px 0 var(--judge), var(--shadow-card)' }}
            aria-label={`第 ${evaluation.round} 轮评审`}
        >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="flex items-center gap-2">
                    <span className="stone stone-jury" aria-hidden="true" />
                    <span className="font-medium text-jury">评审</span>
                    <span className="t-meta">第 {evaluation.round} 轮</span>
                </span>
                <span className="flex items-baseline gap-3 ml-auto">
                    <span className={`numeral text-[1.75rem] leading-none ${winner === 'pro' ? 'text-pro' : 'text-ink-3'}`}>{pro}</span>
                    <span className="t-small text-ink-2">{winner === 'tie' ? '持平' : `${WINNER_TEXT[winner]}胜`}</span>
                    <span className={`numeral text-[1.75rem] leading-none ${winner === 'con' ? 'text-con' : 'text-ink-3'}`}>{con}</span>
                </span>
            </div>

            {evaluation.commentary && <p className="mt-3 text-ink-2 reading">{evaluation.commentary}</p>}

            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="mt-3 inline-flex items-center gap-1 t-small text-ink-3 hover:text-ink"
            >
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                分项得分
            </button>
            {open && (
                <div className="mt-3 space-y-2 max-w-md">
                    {DIMENSIONS.map(d => (
                        <DimensionRow key={d.key} label={d.label} pro={evaluation.pro_score[d.key]} con={evaluation.con_score[d.key]} />
                    ))}
                </div>
            )}
        </article>
    )
}

/** Running totals for the side panel; final once the verdict is in. */
export function ScoreBoard({ evaluations, verdict }: { evaluations: RoundEvaluation[]; verdict: FinalVerdict | null }) {
    const pro = verdict?.pro_total_score ?? evaluations.reduce((sum, e) => sum + roundTotal(e.pro_score), 0)
    const con = verdict?.con_total_score ?? evaluations.reduce((sum, e) => sum + roundTotal(e.con_score), 0)
    const proWins = evaluations.filter(e => e.round_winner === 'pro').length
    const conWins = evaluations.filter(e => e.round_winner === 'con').length

    return (
        <div>
            <div className="flex items-baseline justify-between">
                <span className="numeral text-[2.5rem] leading-none text-pro">{pro}</span>
                <span className="t-meta">{verdict ? '最终' : '累计'}</span>
                <span className="numeral text-[2.5rem] leading-none text-con">{con}</span>
            </div>
            <div className="flex justify-between t-meta mt-1">
                <span>赢 {proWins} 轮</span>
                <span>赢 {conWins} 轮</span>
            </div>
            {evaluations.length > 0 && (
                <ol className="mt-4 space-y-1 t-small">
                    {[...evaluations].sort((a, b) => a.round - b.round).map(e => (
                        <li key={e.round} className="grid grid-cols-[1fr_auto_1fr] items-baseline tabular-nums">
                            <span className={e.round_winner === 'pro' ? 'text-pro font-medium' : 'text-ink-2'}>{roundTotal(e.pro_score)}</span>
                            <span className="t-meta">第 {e.round} 轮</span>
                            <span className={`text-right ${e.round_winner === 'con' ? 'text-con font-medium' : 'text-ink-2'}`}>{roundTotal(e.con_score)}</span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    )
}

const MARGIN_TEXT: Record<string, string> = {
    decisive: '优势明显',
    close: '比分接近',
    marginal: '险胜',
}

/** The final ruling: the one orchestrated moment on the page. */
export function VerdictPanel({ id, verdict }: { id?: string; verdict: FinalVerdict }) {
    const { winner } = verdict
    const headline = winner === 'tie' ? '平局' : `${WINNER_TEXT[winner]}胜`
    const color = winner === 'pro' ? 'text-pro' : winner === 'con' ? 'text-con' : 'text-ink'

    return (
        <section
            id={id}
            className="scroll-mt-40 arrive panel px-6 sm:px-10 py-10 text-center"
            style={{ boxShadow: 'inset 0 4px 0 var(--judge), var(--shadow-card)' }}
            aria-labelledby="verdict-title"
        >
            <p className="flex items-center justify-center gap-2 text-jury font-medium">
                <span className="stone stone-jury" aria-hidden="true" />评审团裁决
            </p>
            <h2 id="verdict-title" className={`display text-[3rem] sm:text-[4rem] mt-3 ${color}`}>{headline}</h2>
            <p className="mt-3 flex items-baseline justify-center gap-5">
                <span className="numeral text-[2.25rem] leading-none text-pro">{verdict.pro_total_score}</span>
                <span className="t-small text-ink-2">{MARGIN_TEXT[verdict.margin] ?? verdict.margin}</span>
                <span className="numeral text-[2.25rem] leading-none text-con">{verdict.con_total_score}</span>
            </p>

            {verdict.summary && <p className="mt-6 text-ink-2 max-w-[36rem] mx-auto reading">{verdict.summary}</p>}

            {(verdict.pro_strengths.length > 0 || verdict.con_strengths.length > 0) && (
                <div className="mt-8 grid sm:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
                    {(['pro', 'con'] as const).map(side => {
                        const items = side === 'pro' ? verdict.pro_strengths : verdict.con_strengths
                        if (!items.length) return <div key={side} />
                        return (
                            <div key={side} className="bg-page rounded-lg px-5 py-4">
                                <h3 className="font-sans text-base font-medium flex items-center gap-2 mb-2">
                                    <span className={`stone stone-${side}`} aria-hidden="true" />
                                    {side === 'pro' ? '正方' : '反方'}做得好的地方
                                </h3>
                                <ul className="space-y-1.5 t-small text-ink-2 list-disc pl-5 marker:text-ink-3">
                                    {items.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )
                    })}
                </div>
            )}

            {verdict.key_turning_points.length > 0 && (
                <div className="mt-6 max-w-3xl mx-auto text-left">
                    <h3 className="font-sans text-base font-medium mb-2">关键转折</h3>
                    <ol className="space-y-1.5 t-small text-ink-2 list-decimal pl-5 marker:text-ink-3">
                        {verdict.key_turning_points.map((p, i) => <li key={i}>{p}</li>)}
                    </ol>
                </div>
            )}
        </section>
    )
}
