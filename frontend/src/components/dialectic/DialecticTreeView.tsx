import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DialecticTree } from '@/types'
import { dialecticTurnId } from '@/features/dialectic/turnIds'

type Kind = 'thesis' | 'antithesis' | 'synthesis'

interface TreeNode {
    id: string
    kind: Kind
    round: number
    label: string
}

const KIND_NAME: Record<Kind, string> = { thesis: '正题', antithesis: '反题', synthesis: '合题' }
const KIND_COLOR: Record<Kind, string> = { thesis: 'var(--voice-a)', antithesis: 'var(--voice-b)', synthesis: 'var(--judge)' }

interface DrawnEdge {
    id: string
    d: string
    style: 'oppose' | 'merge' | 'carry'
    color: string
    source: string
    target: string
}

/**
 * How the idea evolved: each round's thesis (left) and antithesis (right) face each
 * other, converge into the synthesis (center), and the synthesis flows down to become
 * the next round's thesis. Same visual vocabulary as the debate clash map.
 */
export function DialecticTreeView({ tree }: { tree: DialecticTree | null }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const nodeRefs = useRef(new Map<string, HTMLElement>())
    const [drawn, setDrawn] = useState<DrawnEdge[]>([])
    const [size, setSize] = useState({ w: 0, h: 0 })
    const [focus, setFocus] = useState<string | null>(null)

    const nodes = useMemo<TreeNode[]>(() => (tree?.nodes ?? []).flatMap(n => {
        const data = (n as { data?: { kind?: string; round?: number; label?: string } }).data
        if (!data?.kind || !data.round) return []
        return [{ id: n.id, kind: data.kind as Kind, round: data.round, label: data.label ?? '' }]
    }), [tree])
    const edges = useMemo(() => tree?.edges ?? [], [tree])
    const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
    const rounds = useMemo(() => [...new Set(nodes.map(n => n.round))].sort((a, b) => a - b), [nodes])

    useLayoutEffect(() => {
        const container = containerRef.current
        if (!container) return

        const measure = () => {
            const box = container.getBoundingClientRect()
            setSize({ w: box.width, h: box.height })
            const rect = (el: HTMLElement) => {
                const r = el.getBoundingClientRect()
                return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: r.left - box.left + r.width / 2, cy: r.top - box.top + r.height / 2 }
            }
            const next: DrawnEdge[] = []
            for (const edge of edges) {
                const source = byId.get(edge.source)
                const target = byId.get(edge.target)
                const sEl = nodeRefs.current.get(edge.source)
                const tEl = nodeRefs.current.get(edge.target)
                if (!source || !target || !sEl || !tEl) continue
                const s = rect(sEl)
                const t = rect(tEl)
                let d: string
                let style: DrawnEdge['style']
                if (source.round === target.round && target.kind === 'antithesis') {
                    // Thesis and antithesis face each other across the middle.
                    d = `M ${s.r} ${s.cy} L ${t.l} ${t.cy}`
                    style = 'oppose'
                } else if (target.kind === 'synthesis') {
                    // Both sides converge into the synthesis below them.
                    const sx = s.cx, sy = s.b, tx = source.kind === 'thesis' ? t.l + 24 : t.r - 24, ty = t.t
                    d = `M ${sx} ${sy} C ${sx} ${(sy + ty) / 2}, ${tx} ${(sy + ty) / 2}, ${tx} ${ty}`
                    style = 'merge'
                } else {
                    // The synthesis carries down into the next round's thesis.
                    const sx = s.cx, sy = s.b, tx = t.cx, ty = t.t
                    d = `M ${sx} ${sy} C ${sx} ${(sy + ty) / 2 + 12}, ${tx} ${(sy + ty) / 2 - 12}, ${tx} ${ty}`
                    style = 'carry'
                }
                next.push({ id: edge.id, d, style, color: KIND_COLOR[source.kind], source: edge.source, target: edge.target })
            }
            setDrawn(next)
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(container)
        return () => observer.disconnect()
    }, [edges, byId, nodes])

    if (nodes.length === 0) {
        return <p className="t-small text-ink-3">第一轮结束后，这里会画出观点是怎么演变的。</p>
    }

    const linked = (e: DrawnEdge) => !focus || e.source === focus || e.target === focus
    const jump = (node: TreeNode) =>
        document.getElementById(dialecticTurnId(node.round, node.kind))?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    const card = (node: TreeNode | undefined, column: number, row: number, compact = false) => {
        if (!node) return null
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
                className={`panel text-left px-3.5 py-2.5 transition-opacity ${dim ? 'opacity-30' : ''} ${node.kind === 'synthesis' ? 'justify-self-center w-full max-w-[26rem]' : ''}`}
                style={{
                    gridColumn: column,
                    gridRow: row,
                    boxShadow: `inset ${node.kind === 'antithesis' ? '-3px' : '3px'} 0 0 ${KIND_COLOR[node.kind]}, var(--shadow-card)`,
                }}
                aria-label={`第 ${node.round} 轮${KIND_NAME[node.kind]}：${node.label}`}
            >
                <span className="block t-meta">第 {node.round} 轮{KIND_NAME[node.kind]}{compact ? '，沿用上一轮合题' : ''}</span>
                <span className={`block t-small text-ink mt-0.5 ${compact ? 'line-clamp-1 text-ink-2' : 'line-clamp-3'}`}>{node.label}</span>
            </button>
        )
    }

    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 t-meta mb-4">
                <span className="flex items-center gap-1.5">
                    <svg width="28" height="8" aria-hidden="true"><path d="M1 4 H27" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                    对立
                </span>
                <span className="flex items-center gap-1.5">
                    <svg width="28" height="8" aria-hidden="true"><path d="M1 4 H22" stroke="var(--ink-2)" strokeWidth="1.75" /><path d="M20 1 L26 4 L20 7 Z" fill="var(--ink-2)" /></svg>
                    综合
                </span>
                <span className="flex items-center gap-1.5">
                    <svg width="28" height="8" aria-hidden="true"><path d="M1 4 H22" stroke="var(--judge)" strokeWidth="1.75" /><path d="M20 1 L26 4 L20 7 Z" fill="var(--judge)" /></svg>
                    成为下一轮正题
                </span>
            </div>

            <div ref={containerRef} className="relative">
                <svg className="absolute inset-0 pointer-events-none overflow-visible" width={size.w} height={size.h} aria-hidden="true">
                    <defs>
                        {(['thesis', 'antithesis', 'synthesis'] as Kind[]).map(k => (
                            <marker key={k} id={`tree-arrow-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                                <path d="M0 0 L8 4 L0 8 Z" fill={KIND_COLOR[k]} />
                            </marker>
                        ))}
                    </defs>
                    {drawn.map(e => {
                        const sourceKind = byId.get(e.source)?.kind ?? 'thesis'
                        return (
                            <path
                                key={e.id}
                                d={e.d}
                                fill="none"
                                stroke={e.style === 'oppose' ? 'var(--ink-3)' : e.color}
                                strokeWidth={e.style === 'oppose' ? 1.5 : 1.75}
                                strokeDasharray={e.style === 'oppose' ? '4 3' : undefined}
                                markerEnd={e.style === 'oppose' ? undefined : `url(#tree-arrow-${sourceKind})`}
                                opacity={linked(e) ? 0.9 : 0.12}
                                style={{ transition: 'opacity 150ms ease' }}
                            />
                        )
                    })}
                </svg>

                <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] gap-y-10">
                    {rounds.map((round, i) => {
                        const of = (kind: Kind) => nodes.find(n => n.round === round && n.kind === kind)
                        const row = i * 2 + 1
                        return [
                            card(of('thesis'), 1, row, round > 1),
                            <span
                                key={`label-${round}`}
                                className="self-center justify-self-center numeral t-small text-ink-3"
                                style={{ gridColumn: 2, gridRow: row }}
                                aria-hidden="true"
                            >
                                {round}
                            </span>,
                            card(of('antithesis'), 3, row),
                            <div key={`syn-${round}`} className="flex justify-center" style={{ gridColumn: '1 / span 3', gridRow: row + 1 }}>
                                {card(of('synthesis'), 1, 1)}
                            </div>,
                        ]
                    })}
                </div>
            </div>
        </div>
    )
}
