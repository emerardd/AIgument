import { useEffect, useState } from 'react'
import { analysisAPI } from '@/services/api'
import type { DebateStats } from '@/types'
import { ChevronDown } from 'lucide-react'

const percent = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '—')

function Figure({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: 'pro' | 'con' }) {
    return (
        <div className="py-1">
            <div className="text-[0.8125rem] text-ink-3">{label}</div>
            <div className={`numeral text-[2rem] leading-tight ${tone === 'pro' ? 'text-pro' : tone === 'con' ? 'text-con' : 'text-ink'}`}>{value}</div>
            {note && <div className="text-[0.8125rem] text-ink-3 tabular-nums">{note}</div>}
        </div>
    )
}

/** Debate outcomes and a model leaderboard built from mixed-model debates. */
export function StatsPanel() {
    const [open, setOpen] = useState(false)
    const [stats, setStats] = useState<DebateStats | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || stats) return
        let active = true
        analysisAPI.getStats()
            .then(res => { if (active) setStats(res.data) })
            .catch(() => { if (active) setError('统计数据读取失败，请刷新后重试。') })
        return () => { active = false }
    }, [open, stats])

    const total = stats?.total_debates ?? 0

    return (
        <section className="mb-10">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink"
                aria-expanded={open}
            >
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                辩论统计
            </button>

            {open && (
                <div className="arrive mt-4 panel px-5 py-5 space-y-6">
                    {error ? (
                        <p className="text-sm text-destructive">{error}</p>
                    ) : !stats ? (
                        <p className="text-sm text-ink-3">正在统计…</p>
                    ) : total === 0 ? (
                        <p className="text-sm text-ink-3">还没有打完的对抗辩论。打完一场，这里就会有胜负和模型表现。</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                                <Figure label="打完的辩论" value={total} note={`其中 ${stats.mixed_model_debates} 场双方模型不同`} />
                                <Figure label="正方胜" value={stats.pro_wins} note={percent(stats.pro_wins, total)} tone="pro" />
                                <Figure label="反方胜" value={stats.con_wins} note={percent(stats.con_wins, total)} tone="con" />
                                <Figure label="平局" value={stats.ties} note={percent(stats.ties, total)} />
                            </div>
                            <p className="text-[0.8125rem] text-ink-3 tabular-nums">
                                平均总分：正方 {stats.avg_score_pro ?? '—'}，反方 {stats.avg_score_con ?? '—'}
                            </p>

                            <div className="pt-5 border-t border-line">
                                <h3 className="text-base">模型对战排行</h3>
                                <p className="text-[0.8125rem] text-ink-3 mt-1 mb-3">只算双方用了不同模型的场次。</p>
                                {stats.leaderboard.length === 0 ? (
                                    <p className="text-sm text-ink-3">打开“双方用不同模型”打完一场后，这里会出现排行。</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-[0.8125rem] text-ink-3 border-b border-line-strong">
                                                    <th className="text-left font-normal py-2 pr-3">模型</th>
                                                    <th className="text-right font-normal py-2 px-3">场次</th>
                                                    <th className="text-right font-normal py-2 px-3">胜 / 负 / 平</th>
                                                    <th className="text-right font-normal py-2 px-3">胜率</th>
                                                    <th className="text-right font-normal py-2 pl-3">平均得分</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.leaderboard.map(row => (
                                                    <tr key={row.model} className="border-b border-line last:border-0">
                                                        <td className="py-2.5 pr-3 break-all">{row.model}</td>
                                                        <td className="py-2.5 px-3 text-right tabular-nums text-ink-2">{row.debates}</td>
                                                        <td className="py-2.5 px-3 text-right tabular-nums text-ink-2">{row.wins} / {row.losses} / {row.ties}</td>
                                                        <td className="py-2.5 px-3 text-right tabular-nums font-medium">{Math.round(row.win_rate * 100)}%</td>
                                                        <td className="py-2.5 pl-3 text-right tabular-nums text-ink-2">{row.avg_score}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    )
}
