import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CopyButton } from '@/components/ui/CopyButton'
import { ArgumentMap } from './ArgumentMap'
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
                className="w-full flex items-baseline gap-3 text-left"
            >
                <ChevronDown className={`w-4 h-4 self-center text-ink-3 transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden="true" />
                <h2 id="graph-title" className="text-[1.25rem]">论点交锋</h2>
                <span className="t-meta">{scores.total_arguments} 个论点，{scores.total_relations} 条关系</span>
            </button>

            {expanded && (
                <div className="arrive pt-6 space-y-10">
                    <ScoreOverview scores={scores} />

                    <div className="grid md:grid-cols-2 gap-8">
                        <StrongestArguments title="正方最有力的论点" arguments={graph.summary.pro_strongest} side="pro" />
                        <StrongestArguments title="反方最有力的论点" arguments={graph.summary.con_strongest} side="con" />
                    </div>

                    <div className="panel px-4 sm:px-6 py-5">
                        <ArgumentMap nodes={graph.nodes} edges={graph.edges} />
                    </div>

                    {mermaid && (
                        <div className="flex items-center gap-2 t-meta">
                            <CopyButton text={mermaid} />
                            <span>复制 Mermaid 图表代码，可以粘贴到其他支持 Mermaid 的工具里</span>
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
