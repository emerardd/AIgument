import { useState } from 'react'
import type { DebateStandings, FinalVerdict, RoundEvaluation, RoundScore } from '@/types'
import { ChevronDown } from 'lucide-react'

const DIMENSIONS: { key: keyof RoundScore; label: string }[] = [
    { key: 'logic', label: '逻辑' },
    { key: 'evidence', label: '论据' },
    { key: 'rhetoric', label: '表达' },
    { key: 'rebuttal', label: '反驳' },
]

const total = (score: RoundScore) => score.logic + score.evidence + score.rhetoric + score.rebuttal

const WINNER_TEXT = { pro: '正方', con: '反方', tie: '平' } as const

/** Two sides' points for one dimension, drawn from the spine outwards. */
function DimensionRow({ label, pro, con }: { label: string; pro: number; con: number }) {
    return (
        <div className="grid grid-cols-[2rem_1fr_3rem_1fr_2rem] items-center gap-2 text-[0.8125rem]">
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

/** The jury's call for one round, placed across the spine. */
export function RoundRuling({ evaluation }: { evaluation: RoundEvaluation }) {
    const [open, setOpen] = useState(false)
    const pro = total(evaluation.pro_score)
    const con = total(evaluation.con_score)
    const winner = evaluation.round_winner

    return (
        <div className="arrive relative z-10 mx-auto w-full max-w-xl panel px-5 py-4">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="w-full flex items-center justify-center gap-4"
            >
                <span className={`numeral text-3xl ${winner === 'pro' ? 'text-pro' : 'text-ink-3'}`}>{pro}</span>
                <span className="text-center leading-tight">
                    <span className="block text-[0.75rem] text-ink-3">第 {evaluation.round} 轮评审</span>
                    <span className="block text-sm text-jury font-medium">
                        {winner === 'tie' ? '本轮持平' : `${WINNER_TEXT[winner]}胜`}
                    </span>
                </span>
                <span className={`numeral text-3xl ${winner === 'con' ? 'text-con' : 'text-ink-3'}`}>{con}</span>
                <ChevronDown className={`w-4 h-4 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {evaluation.commentary && (
                <p className="mt-3 text-sm text-ink-2 text-center max-w-prose mx-auto">{evaluation.commentary}</p>
            )}

            {open && (
                <div className="mt-4 pt-4 border-t border-line space-y-2">
                    {DIMENSIONS.map(d => (
                        <DimensionRow key={d.key} label={d.label} pro={evaluation.pro_score[d.key]} con={evaluation.con_score[d.key]} />
                    ))}
                    {evaluation.highlights && evaluation.highlights.length > 0 && (
                        <ul className="pt-3 text-[0.8125rem] text-ink-2 space-y-1">
                            {evaluation.highlights.map((h, i) => <li key={i}>{h}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

/** Running score, shown in the board header while the debate is live. */
export function LiveScore({ standings }: { standings: DebateStandings }) {
    return (
        <div className="flex items-center gap-3" aria-label="实时比分">
            <span className="numeral text-xl text-pro">{standings.pro_total_score}</span>
            <span className="text-[0.75rem] text-ink-3 tabular-nums">
                {standings.current_round}/{standings.total_rounds} 轮
            </span>
            <span className="numeral text-xl text-con">{standings.con_total_score}</span>
        </div>
    )
}

const MARGIN_TEXT: Record<string, string> = {
    decisive: '优势明显',
    close: '比分接近',
    marginal: '险胜',
}

/** The final ruling: the one loud moment on the page. */
export function VerdictPanel({ verdict }: { verdict: FinalVerdict }) {
    const { winner } = verdict
    const headline = winner === 'tie' ? '平局' : `${WINNER_TEXT[winner]}胜`
    const color = winner === 'pro' ? 'text-pro' : winner === 'con' ? 'text-con' : 'text-ink'

    return (
        <section className="arrive relative z-10 border-y-2 border-jury bg-board py-10 px-2 sm:px-6" aria-labelledby="verdict-title">
            <p className="text-center text-sm text-jury">评审团裁决</p>
            <h2 id="verdict-title" className={`display text-center text-[3.25rem] sm:text-[4.5rem] mt-2 ${color}`}>{headline}</h2>
            <p className="mt-2 flex items-baseline justify-center gap-4">
                <span className="numeral text-3xl text-pro">{verdict.pro_total_score}</span>
                <span className="text-sm text-ink-3">{MARGIN_TEXT[verdict.margin] ?? verdict.margin}</span>
                <span className="numeral text-3xl text-con">{verdict.con_total_score}</span>
            </p>

            {verdict.summary && (
                <p className="mt-6 text-center text-ink-2 max-w-[36rem] mx-auto leading-[1.9]">{verdict.summary}</p>
            )}

            {(verdict.pro_strengths.length > 0 || verdict.con_strengths.length > 0) && (
                <div className="mt-8 grid sm:grid-cols-2 gap-6 sm:gap-10 max-w-3xl mx-auto">
                    {(['pro', 'con'] as const).map(side => {
                        const items = side === 'pro' ? verdict.pro_strengths : verdict.con_strengths
                        if (!items.length) return <div key={side} />
                        return (
                            <div key={side}>
                                <h3 className="font-sans text-sm font-medium flex items-center gap-2 mb-2">
                                    <span className={`stone stone-${side}`} aria-hidden="true" />
                                    {side === 'pro' ? '正方' : '反方'}做得好的地方
                                </h3>
                                <ul className="space-y-1.5 text-sm text-ink-2 list-disc pl-5 marker:text-ink-3">
                                    {items.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )
                    })}
                </div>
            )}

            {verdict.key_turning_points.length > 0 && (
                <div className="mt-8 max-w-3xl mx-auto">
                    <h3 className="font-sans text-sm font-medium mb-2">关键转折</h3>
                    <ol className="space-y-1.5 text-sm text-ink-2 list-decimal pl-5 marker:text-ink-3">
                        {verdict.key_turning_points.map((p, i) => <li key={i}>{p}</li>)}
                    </ol>
                </div>
            )}
        </section>
    )
}
