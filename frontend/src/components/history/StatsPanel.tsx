import { useEffect, useState } from 'react'
import { analysisAPI } from '@/services/api'
import type { DebateStats } from '@/types'
import { BarChart3, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

const percent = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '—')

function StatTile({ label, value, note }: { label: string; value: string | number; note?: string }) {
    return (
        <div className="rounded-xl bg-muted/30 px-4 py-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">{value}</div>
            {note && <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">{note}</div>}
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
            .catch(() => { if (active) setError('统计数据加载失败') })
        return () => { active = false }
    }, [open, stats])

    const total = stats?.total_debates ?? 0

    return (
        <section className="glass shadow-soft rounded-2xl mb-6">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                aria-expanded={open}
            >
                <span className="flex items-center gap-2 font-semibold">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    辩论统计
                </span>
                {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {open && (
                <div className="px-5 pb-5 space-y-5">
                    {error ? (
                        <p className="text-sm text-destructive">{error}</p>
                    ) : !stats ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" /> 加载中
                        </div>
                    ) : total === 0 ? (
                        <p className="text-sm text-muted-foreground">还没有完成的多 Agent 辩论。完成一场后这里会显示胜负和模型表现。</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatTile label="完成的辩论" value={total} note={`混合模型 ${stats.mixed_model_debates} 场`} />
                                <StatTile label="正方胜" value={stats.pro_wins} note={percent(stats.pro_wins, total)} />
                                <StatTile label="反方胜" value={stats.con_wins} note={percent(stats.con_wins, total)} />
                                <StatTile label="平局" value={stats.ties} note={percent(stats.ties, total)} />
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                                平均总分：正方 {stats.avg_score_pro ?? '—'} · 反方 {stats.avg_score_con ?? '—'}
                            </p>

                            <div>
                                <h3 className="text-sm font-medium mb-1">模型对战排行</h3>
                                <p className="text-xs text-muted-foreground mb-3">只统计正反方使用不同模型的辩论。</p>
                                {stats.leaderboard.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">开启“混合模型”完成一场辩论后显示。</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-xs text-muted-foreground border-b border-border">
                                                    <th className="text-left font-medium py-2 pr-3">模型</th>
                                                    <th className="text-right font-medium py-2 px-3">场次</th>
                                                    <th className="text-right font-medium py-2 px-3">胜 / 负 / 平</th>
                                                    <th className="text-right font-medium py-2 px-3">胜率</th>
                                                    <th className="text-right font-medium py-2 pl-3">平均得分</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.leaderboard.map(row => (
                                                    <tr key={row.model} className="border-b border-border/50 last:border-0">
                                                        <td className="py-2 pr-3 font-medium text-foreground break-all">{row.model}</td>
                                                        <td className="py-2 px-3 text-right tabular-nums">{row.debates}</td>
                                                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                                            {row.wins} / {row.losses} / {row.ties}
                                                        </td>
                                                        <td className="py-2 px-3 text-right tabular-nums">{Math.round(row.win_rate * 100)}%</td>
                                                        <td className="py-2 pl-3 text-right tabular-nums">{row.avg_score}</td>
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
