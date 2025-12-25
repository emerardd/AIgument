import type { RoundScore, RoundEvaluation, DebateStandings } from '@/types'
import { Trophy, TrendingUp, Target, MessageSquare, Award } from 'lucide-react'

interface ScoreBadgeProps {
    label: string
    score: number
    maxScore?: number
}

function ScoreBadge({ label, score, maxScore = 10 }: ScoreBadgeProps) {
    const percentage = (score / maxScore) * 100
    const getColor = () => {
        if (percentage >= 80) return 'text-green-500'
        if (percentage >= 60) return 'text-yellow-500'
        return 'text-orange-500'
    }

    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-12">{label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${percentage >= 80 ? 'bg-green-500' :
                        percentage >= 60 ? 'bg-yellow-500' : 'bg-orange-500'
                        }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className={`font-medium w-6 text-right ${getColor()}`}>{score}</span>
        </div>
    )
}

interface ScoreCardProps {
    title: string
    score: RoundScore
    isWinner?: boolean
    side: 'pro' | 'con'
}

export function ScoreCard({ title, score, isWinner, side }: ScoreCardProps) {
    const total = score.logic + score.evidence + score.rhetoric + score.rebuttal
    const borderColor = side === 'pro' ? 'border-blue-500' : 'border-orange-500'
    const bgColor = side === 'pro' ? 'bg-blue-500/5' : 'bg-orange-500/5'

    return (
        <div className={`
            relative p-4 rounded-xl border ${borderColor} ${bgColor}
            ${isWinner ? 'ring-2 ring-primary ring-offset-2' : ''}
        `}>
            {isWinner && (
                <div className="absolute -top-2 -right-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                        <Trophy className="w-3 h-3" />
                        胜
                    </span>
                </div>
            )}

            <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">{title}</span>
                <span className="text-lg font-bold">{total}<span className="text-xs text-muted-foreground">/40</span></span>
            </div>

            <div className="space-y-2">
                <ScoreBadge label="逻辑" score={score.logic} />
                <ScoreBadge label="论据" score={score.evidence} />
                <ScoreBadge label="表达" score={score.rhetoric} />
                <ScoreBadge label="反驳" score={score.rebuttal} />
            </div>
        </div>
    )
}

interface EvaluationPanelProps {
    evaluation: RoundEvaluation
}

export function EvaluationPanel({ evaluation }: EvaluationPanelProps) {
    return (
        <div className="my-6 p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Award className="w-4 h-4 text-primary" />
                <span>第 {evaluation.round} 轮评审</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ScoreCard
                    title="正方"
                    score={evaluation.pro_score}
                    isWinner={evaluation.round_winner === 'pro'}
                    side="pro"
                />
                <ScoreCard
                    title="反方"
                    score={evaluation.con_score}
                    isWinner={evaluation.round_winner === 'con'}
                    side="con"
                />
            </div>

            {evaluation.commentary && (
                <div className="p-3 rounded-lg bg-background/50 text-sm">
                    <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <p className="text-muted-foreground">{evaluation.commentary}</p>
                    </div>
                </div>
            )}

            {evaluation.highlights && evaluation.highlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {evaluation.highlights.map((highlight, idx) => (
                        <span key={idx} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                            ✨ {highlight}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

interface StandingsPanelProps {
    standings: DebateStandings
}

export function StandingsPanel({ standings }: StandingsPanelProps) {
    const proPercentage = standings.pro_total_score + standings.con_total_score > 0
        ? (standings.pro_total_score / (standings.pro_total_score + standings.con_total_score)) * 100
        : 50

    return (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-xl bg-background/95 backdrop-blur border shadow-lg min-w-[200px]">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span>实时比分</span>
                <span className="ml-auto text-xs text-muted-foreground">
                    第 {standings.current_round}/{standings.total_rounds} 轮
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-blue-500 font-medium">正方</span>
                    <span className="text-orange-500 font-medium">反方</span>
                </div>

                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${proPercentage}%` }}
                    />
                    <div
                        className="h-full bg-orange-500 transition-all duration-500"
                        style={{ width: `${100 - proPercentage}%` }}
                    />
                </div>

                <div className="flex justify-between text-lg font-bold">
                    <span className="text-blue-500">{standings.pro_total_score}</span>
                    <span className="text-muted-foreground">:</span>
                    <span className="text-orange-500">{standings.con_total_score}</span>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>赢 {standings.pro_round_wins} 轮</span>
                    <span>赢 {standings.con_round_wins} 轮</span>
                </div>
            </div>
        </div>
    )
}

interface VerdictPanelProps {
    winner: 'pro' | 'con' | 'tie'
    proScore: number
    conScore: number
    margin: string
    summary: string
    proStrengths: string[]
    conStrengths: string[]
    keyTurningPoints: string[]
}

export function VerdictPanel({
    winner,
    proScore,
    conScore,
    margin,
    summary,
    proStrengths,
    conStrengths,
    keyTurningPoints
}: VerdictPanelProps) {
    const getWinnerText = () => {
        if (winner === 'tie') return '平局'
        return winner === 'pro' ? '正方获胜' : '反方获胜'
    }

    const getMarginText = () => {
        switch (margin) {
            case 'decisive': return '压倒性'
            case 'close': return '接近'
            case 'marginal': return '微弱'
            default: return margin
        }
    }

    const winnerColor = winner === 'pro' ? 'text-blue-500' : winner === 'con' ? 'text-orange-500' : 'text-muted-foreground'

    return (
        <div className="my-8 p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 space-y-6 animate-scale-in">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
                    <Trophy className="w-5 h-5 text-primary" />
                    <span className="font-medium">最终裁决</span>
                </div>

                <h3 className={`text-2xl font-bold ${winnerColor}`}>
                    {getWinnerText()}
                </h3>

                <div className="flex items-center justify-center gap-4 text-lg">
                    <span className="text-blue-500 font-bold">{proScore}</span>
                    <span className="text-muted-foreground">:</span>
                    <span className="text-orange-500 font-bold">{conScore}</span>
                    <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
                        {getMarginText()}优势
                    </span>
                </div>
            </div>

            {summary && (
                <p className="text-center text-muted-foreground">{summary}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
                {proStrengths && proStrengths.length > 0 && (
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div className="text-xs font-medium text-blue-500 mb-2">正方优势</div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                            {proStrengths.map((s, i) => (
                                <li key={i}>• {s}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {conStrengths && conStrengths.length > 0 && (
                    <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                        <div className="text-xs font-medium text-orange-500 mb-2">反方优势</div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                            {conStrengths.map((s, i) => (
                                <li key={i}>• {s}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {keyTurningPoints && keyTurningPoints.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-xs font-medium mb-2">
                        <Target className="w-3 h-3" />
                        关键转折点
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                        {keyTurningPoints.map((point, i) => (
                            <li key={i}>• {point}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
