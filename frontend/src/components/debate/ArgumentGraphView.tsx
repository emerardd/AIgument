import { useEffect, useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { MermaidRenderer } from '@/components/ui/MermaidRenderer'
import { buildApiUrl } from '@/config/env'

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
                const response = await fetch(buildApiUrl(`/api/debate/${sessionId}/graph`))
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
            <p className="text-sm text-ink-3 py-3 border-y border-line" role="status">正在生成论点图谱…</p>
        )
    }

    if (error) {
        return (
            <p className="text-sm text-ink-2 py-3 border-y border-line" role="alert">论点图谱没能生成：{error}</p>
        )
    }

    if (!graph || !scores) {
        return null
    }

    return (
        <section aria-labelledby="graph-title">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="w-full flex items-baseline gap-3 py-3 border-y border-line text-left"
            >
                <ChevronDown className={`w-4 h-4 self-center text-ink-3 transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden="true" />
                <h2 id="graph-title" className="text-lg">论点图谱</h2>
                <span className="text-[0.8125rem] text-ink-3">{scores.total_arguments} 个论点，{scores.total_relations} 条关系</span>
            </button>

            {expanded && (
                <div className="arrive pt-6 space-y-10">
                    <ScoreOverview scores={scores} />

                    <div className="grid md:grid-cols-2 gap-8">
                        <StrongestArguments title="正方最有力的论点" arguments={graph.summary.pro_strongest} side="pro" />
                        <StrongestArguments title="反方最有力的论点" arguments={graph.summary.con_strongest} side="con" />
                    </div>

                    <GraphVisualization nodes={graph.nodes} edges={graph.edges} />

                    {mermaid && (
                        <div className="space-y-3">
                            <h3 className="text-base">论点关系图</h3>
                            <div className="panel p-4">
                                <MermaidRenderer code={mermaid} className="min-h-[200px]" />
                            </div>
                            <details className="text-[0.8125rem]">
                                <summary className="text-ink-3 cursor-pointer hover:text-ink">查看 Mermaid 代码</summary>
                                <pre className="mt-2 overflow-x-auto p-3 bg-sunken rounded-md">{mermaid}</pre>
                            </details>
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}

function ScoreOverview({ scores }: { scores: GraphScores }) {
    const leader = scores.leader === 'tie' ? '图谱上双方持平' : scores.leader === 'pro' ? '图谱上正方占优' : '图谱上反方占优'
    return (
        <div>
            <div className="flex items-baseline justify-between mb-2">
                <span className="numeral text-2xl text-pro">{scores.pro_score}</span>
                <span className="text-sm text-ink-2">{leader}</span>
                <span className="numeral text-2xl text-con">{scores.con_score}</span>
            </div>
            <div className="h-2 flex gap-[2px]" role="img" aria-label={`正方 ${scores.pro_percentage}%，反方 ${scores.con_percentage}%`}>
                <div className="h-full bg-pro rounded-l-full" style={{ width: `${scores.pro_percentage}%` }} />
                <div className="h-full bg-con rounded-r-full" style={{ width: `${scores.con_percentage}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[0.8125rem] text-ink-3 tabular-nums">
                <span>{scores.pro_unaddressed} 个论点对方没有回应</span>
                <span>{scores.con_unaddressed} 个论点对方没有回应</span>
            </div>
        </div>
    )
}

const STRENGTH: Record<string, string> = { strong: '强', moderate: '中等', weak: '弱' }

function StrongestArguments({ title, arguments: args, side }: {
    title: string
    arguments: ArgumentNode[]
    side: 'pro' | 'con'
}) {
    return (
        <div>
            <h3 className="font-sans text-sm font-medium flex items-center gap-2 mb-3">
                <span className={`stone stone-${side}`} aria-hidden="true" />
                {title}
            </h3>
            {args.length > 0 ? (
                <ol className="space-y-3 list-decimal pl-5 marker:text-ink-3 text-sm">
                    {args.map((arg) => (
                        <li key={arg.id}>
                            <p className="text-ink-2 line-clamp-3">{arg.key_points[0] || arg.content}</p>
                            <p className="text-[0.75rem] text-ink-3 mt-0.5">
                                强度{STRENGTH[arg.strength?.toLowerCase()] ?? arg.strength}{arg.is_rebutted ? '，已被反驳' : '，对方没有回应'}
                            </p>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-sm text-ink-3">没有可列出的论点。</p>
            )}
        </div>
    )
}

function GraphVisualization({ nodes, edges }: { nodes: ArgumentNode[]; edges: ArgumentEdge[] }) {
    const nodesByRound = useMemo(() => {
        const grouped: Record<number, ArgumentNode[]> = {}
        nodes.forEach(node => {
            (grouped[node.round] ??= []).push(node)
        })
        return grouped
    }, [nodes])

    const attacks = edges.filter(e => e.relation === 'attacks').length
    const supports = edges.filter(e => e.relation === 'builds_on').length

    return (
        <div>
            <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-base">每轮的论点</h3>
                <span className="text-[0.8125rem] text-ink-3">反驳 {attacks} 次，延续 {supports} 次</span>
            </div>
            <div className="border-t border-line">
                {Object.entries(nodesByRound).map(([round, roundNodes]) => (
                    <div key={round} className="grid sm:grid-cols-[4rem_1fr_1fr] gap-x-6 gap-y-2 py-3 border-b border-line text-sm">
                        <span className="text-[0.8125rem] text-ink-3">第 {round} 轮</span>
                        {(['pro', 'con'] as const).map(side => (
                            <div key={side} className="space-y-1.5">
                                {roundNodes.filter(n => n.author === side).map(node => (
                                    <p key={node.id} className={`border-l-2 pl-3 line-clamp-2 ${side === 'pro' ? 'border-pro' : 'border-con'} ${node.is_rebutted ? 'text-ink-3' : 'text-ink-2'}`}>
                                        {node.key_points[0] || node.content}
                                        {node.is_rebutted && <span className="text-[0.75rem]">（已被反驳）</span>}
                                    </p>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
