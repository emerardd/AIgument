import { useEffect, useState, useMemo } from 'react'
import { Network, GitBranch, Target, Trophy, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

interface ArgumentNode {
    id: string
    content: string
    author: 'pro' | 'con'
    round: number
    type: string
    strength: string
    is_rebutted: boolean
    rebuttal_count: number
    support_count: number
    key_points: string[]
}

interface ArgumentEdge {
    id: string
    source: string
    target: string
    relation: string
    strength: number
    description: string
}

interface GraphData {
    topic: string
    nodes: ArgumentNode[]
    edges: ArgumentEdge[]
    summary: {
        pro_arguments: number
        con_arguments: number
        total_relations: number
        scores: Record<string, number>
        pro_strongest: ArgumentNode[]
        con_strongest: ArgumentNode[]
    }
}

interface GraphScores {
    pro_score: number
    con_score: number
    pro_percentage: number
    con_percentage: number
    leader: 'pro' | 'con' | 'tie'
    pro_unaddressed: number
    con_unaddressed: number
    total_arguments: number
    total_relations: number
}

interface ArgumentGraphViewProps {
    sessionId: number
}

export function ArgumentGraphView({ sessionId }: ArgumentGraphViewProps) {
    const [graph, setGraph] = useState<GraphData | null>(null)
    const [scores, setScores] = useState<GraphScores | null>(null)
    const [mermaid, setMermaid] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expanded, setExpanded] = useState(true)

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                setLoading(true)
                const response = await fetch(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/debate/${sessionId}/graph`
                )
                if (!response.ok) {
                    throw new Error('Failed to fetch graph')
                }
                const data = await response.json()
                setGraph(data.graph)
                setScores(data.scores)
                setMermaid(data.mermaid)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        if (sessionId) {
            fetchGraph()
        }
    }, [sessionId])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 rounded-xl bg-destructive/5 text-destructive text-sm text-center">
                {error}
            </div>
        )
    }

    if (!graph || !scores) {
        return null
    }

    return (
        <div className="space-y-4">
            {/* 头部 */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Network className="w-5 h-5 text-primary" />
                    <span className="font-medium">论点图谱分析</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                        {scores.total_arguments} 论点 · {scores.total_relations} 关系
                    </span>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
            </button>

            {expanded && (
                <div className="space-y-6 animate-fade-in">
                    {/* 得分概览 */}
                    <ScoreOverview scores={scores} />

                    {/* 最强论点 */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <StrongestArguments
                            title="正方最强论点"
                            arguments={graph.summary.pro_strongest}
                            side="pro"
                        />
                        <StrongestArguments
                            title="反方最强论点"
                            arguments={graph.summary.con_strongest}
                            side="con"
                        />
                    </div>

                    {/* 图谱可视化 */}
                    <GraphVisualization nodes={graph.nodes} edges={graph.edges} />

                    {/* Mermaid 代码（可选） */}
                    {mermaid && (
                        <details className="p-3 rounded-lg bg-muted/20">
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                                查看 Mermaid 图表代码
                            </summary>
                            <pre className="mt-2 text-xs overflow-x-auto p-2 bg-muted/30 rounded">
                                {mermaid}
                            </pre>
                        </details>
                    )}
                </div>
            )}
        </div>
    )
}

function ScoreOverview({ scores }: { scores: GraphScores }) {
    const getLeaderText = () => {
        if (scores.leader === 'tie') return '势均力敌'
        return scores.leader === 'pro' ? '正方领先' : '反方领先'
    }

    return (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/5 to-orange-500/5 border border-border/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">图谱分析得分</span>
                </div>
                <span className={`
                    text-xs px-2 py-1 rounded-full font-medium
                    ${scores.leader === 'pro' ? 'bg-blue-500/10 text-blue-500' :
                        scores.leader === 'con' ? 'bg-orange-500/10 text-orange-500' :
                            'bg-muted text-muted-foreground'}
                `}>
                    {getLeaderText()}
                </span>
            </div>

            <div className="space-y-3">
                {/* 得分条 */}
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-500 font-medium">正方 {scores.pro_score}</span>
                    <span className="text-orange-500 font-medium">反方 {scores.con_score}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${scores.pro_percentage}%` }}
                    />
                    <div
                        className="h-full bg-orange-500 transition-all duration-500"
                        style={{ width: `${scores.con_percentage}%` }}
                    />
                </div>

                {/* 统计信息 */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center p-2 rounded-lg bg-blue-500/5">
                        <div className="text-lg font-bold text-blue-500">{scores.pro_unaddressed}</div>
                        <div className="text-xs text-muted-foreground">正方未被反驳</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-orange-500/5">
                        <div className="text-lg font-bold text-orange-500">{scores.con_unaddressed}</div>
                        <div className="text-xs text-muted-foreground">反方未被反驳</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StrongestArguments({
    title,
    arguments: args,
    side
}: {
    title: string
    arguments: ArgumentNode[]
    side: 'pro' | 'con'
}) {
    const bgColor = side === 'pro' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-orange-500/5 border-orange-500/20'
    const iconColor = side === 'pro' ? 'text-blue-500' : 'text-orange-500'

    return (
        <div className={`p-4 rounded-xl border ${bgColor}`}>
            <div className="flex items-center gap-2 mb-3">
                <Trophy className={`w-4 h-4 ${iconColor}`} />
                <span className="text-sm font-medium">{title}</span>
            </div>

            {args.length > 0 ? (
                <ul className="space-y-2">
                    {args.map((arg, idx) => (
                        <li key={arg.id} className="text-xs">
                            <div className="flex items-start gap-2">
                                <span className={`font-bold ${iconColor}`}>{idx + 1}.</span>
                                <div>
                                    <p className="text-muted-foreground line-clamp-2">
                                        {arg.content.slice(0, 100)}...
                                    </p>
                                    <div className="flex gap-2 mt-1">
                                        <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                                            {arg.strength}
                                        </span>
                                        {!arg.is_rebutted && (
                                            <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded text-[10px]">
                                                未被反驳
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground">暂无数据</p>
            )}
        </div>
    )
}

function GraphVisualization({
    nodes,
    edges
}: {
    nodes: ArgumentNode[]
    edges: ArgumentEdge[]
}) {
    // 简单的节点可视化
    const nodesByRound = useMemo(() => {
        const grouped: Record<number, ArgumentNode[]> = {}
        nodes.forEach(node => {
            if (!grouped[node.round]) {
                grouped[node.round] = []
            }
            grouped[node.round].push(node)
        })
        return grouped
    }, [nodes])

    return (
        <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
                <GitBranch className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">论点结构</span>
            </div>

            <div className="space-y-4">
                {Object.entries(nodesByRound).map(([round, roundNodes]) => (
                    <div key={round} className="space-y-2">
                        <div className="text-xs text-muted-foreground">第 {round} 轮</div>
                        <div className="flex gap-2">
                            {roundNodes.map(node => {
                                const isPro = node.author === 'pro'
                                return (
                                    <div
                                        key={node.id}
                                        className={`
                                            flex-1 p-3 rounded-lg border text-xs
                                            ${isPro
                                                ? 'bg-blue-500/5 border-blue-500/30'
                                                : 'bg-orange-500/5 border-orange-500/30'
                                            }
                                            ${node.is_rebutted ? 'opacity-60' : ''}
                                        `}
                                    >
                                        <div className={`font-medium mb-1 ${isPro ? 'text-blue-500' : 'text-orange-500'}`}>
                                            {isPro ? '正方' : '反方'}
                                        </div>
                                        <p className="text-muted-foreground line-clamp-2">
                                            {node.key_points[0] || node.content.slice(0, 50)}...
                                        </p>
                                        <div className="flex gap-1 mt-2">
                                            {node.is_rebutted && (
                                                <Target className="w-3 h-3 text-red-500" />
                                            )}
                                            {node.support_count > 0 && (
                                                <span className="text-[10px] text-green-500">
                                                    +{node.support_count} 支持
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* 关系统计 */}
            <div className="mt-4 pt-4 border-t border-border/30">
                <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                        攻击关系：{edges.filter(e => e.relation === 'attacks').length}
                    </span>
                    <span>
                        支持关系：{edges.filter(e => e.relation === 'builds_on').length}
                    </span>
                </div>
            </div>
        </div>
    )
}
