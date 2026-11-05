import { useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface MapNode {
    id: string
    content: string
    author: 'pro' | 'con'
    round: number
    strength: string
    is_rebutted: boolean
    key_points: string[]
}

export interface MapEdge {
    id: string
    source: string
    target: string
    relation: string
}

const SUPPORT_RELATIONS = new Set(['supports', 'builds_on'])
const STRENGTH: Record<string, string> = { strong: '强', moderate: '中等', weak: '弱' }
const SIDE_NAME = { pro: '正方', con: '反方' } as const

interface DrawnEdge {
    id: string
    d: string
    kind: 'rebut' | 'extend'
    voice: 'pro' | 'con'
    source: string
    target: string
}

/** Where an argument lives in the transcript, so a node can jump to it. */
const speechId = (node: MapNode) => `r${node.round}-${node.author}`

/**
 * The clash map: 正方 arguments on the left, 反方 on the right, one row per round.
 * Rebuttals cross the middle in the attacker's color; a side building on its own
 * earlier point loops along the outer edge. Rebutted points fade; unanswered ones say so.
 */
export function ArgumentMap({ nodes, edges }: { nodes: MapNode[]; edges: MapEdge[] }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const nodeRefs = useRef(new Map<string, HTMLElement>())
    const [drawn, setDrawn] = useState<DrawnEdge[]>([])
    const [size, setSize] = useState({ w: 0, h: 0 })
    const [focus, setFocus] = useState<string | null>(null)

    const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
    const rounds = useMemo(() => {
        const grouped = new Map<number, MapNode[]>()
        nodes.forEach(n => grouped.set(n.round, [...(grouped.get(n.round) ?? []), n]))
        return [...grouped.entries()].sort(([a], [b]) => a - b)
    }, [nodes])

    useLayoutEffect(() => {
        const container = containerRef.current
        if (!container) return

        const measure = () => {
            const box = container.getBoundingClientRect()
            setSize({ w: box.width, h: box.height })
            const rel = (r: DOMRect) => ({
                left: r.left - box.left, right: r.right - box.left,
                top: r.top - box.top, mid: r.top - box.top + r.height / 2,
            })
            const next: DrawnEdge[] = []
            for (const edge of edges) {
                const source = byId.get(edge.source)
                const target = byId.get(edge.target)
                const sEl = nodeRefs.current.get(edge.source)
                const tEl = nodeRefs.current.get(edge.target)
                if (!source || !target || !sEl || !tEl) continue
                const s = rel(sEl.getBoundingClientRect())
                const t = rel(tEl.getBoundingClientRect())

                let d: string
                if (source.author !== target.author) {
                    // Across the middle, from the inner edge of one card to the inner edge of the other.
                    const sx = source.author === 'pro' ? s.right : s.left
                    const tx = target.author === 'pro' ? t.right : t.left
                    const mx = (sx + tx) / 2
                    d = `M ${sx} ${s.mid} C ${mx} ${s.mid}, ${mx} ${t.mid}, ${tx} ${t.mid}`
                } else {
                    // Same side: loop along the outer edge.
                    const pro = source.author === 'pro'
                    const sx = pro ? s.left : s.right
                    const tx = pro ? t.left : t.right
                    const out = pro ? -22 : 22
                    d = `M ${sx} ${s.mid} C ${sx + out} ${s.mid}, ${tx + out} ${t.mid}, ${tx} ${t.mid}`
                }
                next.push({
                    id: edge.id, d, source: edge.source, target: edge.target,
                    kind: SUPPORT_RELATIONS.has(edge.relation) ? 'extend' : 'rebut',
                    voice: source.author,
                })
            }
            setDrawn(next)
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(container)
        return () => observer.disconnect()
    }, [edges, byId, nodes])

    const linked = (edge: DrawnEdge) => !focus || edge.source === focus || edge.target === focus
    const rebuts = drawn.filter(e => e.kind === 'rebut').length
    const extends_ = drawn.length - rebuts

    const jump = (node: MapNode) => {
        document.getElementById(speechId(node))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 t-meta mb-4">
                <span className="flex items-center gap-1.5">
                    <svg width="28" height="8" aria-hidden="true"><path d="M1 4 H22" stroke="var(--ink-2)" strokeWidth="1.75" /><path d="M20 1 L26 4 L20 7 Z" fill="var(--ink-2)" /></svg>
                    反驳 {rebuts}
                </span>
                <span className="flex items-center gap-1.5">
                    <svg width="28" height="8" aria-hidden="true"><path d="M1 4 H26" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="3 3" /></svg>
                    延续己方 {extends_}
                </span>
                <span>点一个论点可以跳到原发言</span>
            </div>

            <div ref={containerRef} className="relative px-6 sm:px-8">
                <svg className="absolute inset-0 pointer-events-none overflow-visible" width={size.w} height={size.h} aria-hidden="true">
                    <defs>
                        {(['pro', 'con'] as const).map(v => (
                            <marker key={v} id={`arrow-${v}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                                <path d="M0 0 L8 4 L0 8 Z" fill={v === 'pro' ? 'var(--voice-a)' : 'var(--voice-b)'} />
                            </marker>
                        ))}
                    </defs>
                    {drawn.map(edge => (
                        <path
                            key={edge.id}
                            d={edge.d}
                            fill="none"
                            stroke={edge.kind === 'extend' ? 'var(--ink-3)' : edge.voice === 'pro' ? 'var(--voice-a)' : 'var(--voice-b)'}
                            strokeWidth={edge.kind === 'extend' ? 1.5 : 1.75}
                            strokeDasharray={edge.kind === 'extend' ? '4 4' : undefined}
                            markerEnd={edge.kind === 'rebut' ? `url(#arrow-${edge.voice})` : undefined}
                            opacity={linked(edge) ? 0.9 : 0.12}
                            style={{ transition: 'opacity 150ms ease' }}
                        />
                    ))}
                </svg>

                <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)] gap-y-6">
                    <span className="flex items-center gap-2 t-small font-medium text-pro"><span className="stone stone-pro" aria-hidden="true" />正方</span>
                    <span />
                    <span className="flex items-center justify-end gap-2 t-small font-medium text-con">反方<span className="stone stone-con" aria-hidden="true" /></span>

                    {rounds.map(([round, items], index) => (
                        <div key={round} className="contents">
                            {(['pro', 'con'] as const).map(side => (
                                <div key={side} className="flex flex-col gap-3" style={{ gridRow: index + 2, gridColumn: side === 'pro' ? 1 : 3 }}>
                                    {items.filter(n => n.author === side).map(node => {
                                        const dim = focus !== null && focus !== node.id && !drawn.some(e => linked(e) && (e.source === node.id || e.target === node.id))
                                        return (
                                            <button
                                                key={node.id}
                                                type="button"
                                                ref={el => { if (el) nodeRefs.current.set(node.id, el); else nodeRefs.current.delete(node.id) }}
                                                onMouseEnter={() => setFocus(node.id)}
                                                onMouseLeave={() => setFocus(null)}
                                                onFocus={() => setFocus(node.id)}
                                                onBlur={() => setFocus(null)}
                                                onClick={() => jump(node)}
                                                className={`panel text-left px-3.5 py-2.5 transition-opacity ${node.is_rebutted ? 'opacity-60' : ''} ${dim ? 'opacity-30' : ''}`}
                                                style={{ boxShadow: `inset ${side === 'pro' ? '3px' : '-3px'} 0 0 ${side === 'pro' ? 'var(--voice-a)' : 'var(--voice-b)'}, var(--shadow-card)` }}
                                                aria-label={`第 ${node.round} 轮${SIDE_NAME[side]}论点：${node.key_points[0] || node.content}`}
                                            >
                                                <span className="block t-small text-ink line-clamp-3">{node.key_points[0] || node.content}</span>
                                                <span className="block t-meta mt-1">
                                                    {node.is_rebutted ? '已被反驳' : '对方未回应'}，强度{STRENGTH[node.strength?.toLowerCase()] ?? node.strength}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            ))}
                            <span className="self-start justify-self-center mt-2.5 numeral t-small text-ink-3" style={{ gridRow: index + 2, gridColumn: 2 }} aria-label={`第 ${round} 轮`}>
                                {round}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
