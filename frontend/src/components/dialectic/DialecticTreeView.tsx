import { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import type { DialecticTree } from '@/types'

interface DialecticTreeViewProps {
    tree: DialecticTree | null
}

const KIND = {
    thesis: { label: '正题', className: 'border-l-pro' },
    antithesis: { label: '反题', className: 'border-l-con' },
    synthesis: { label: '合题', className: 'border-l-ink' },
} as const

function DialecticNode({ data }: { data: { label: string; kind: string; round: number } }) {
    const kind = KIND[data.kind as keyof typeof KIND] ?? KIND.synthesis
    return (
        <div className={`min-w-[180px] max-w-[220px] bg-surface border border-line border-l-[3px] rounded-md px-3 py-2 ${kind.className}`}>
            <div className="text-[0.6875rem] text-ink-3">第 {data.round} 轮{kind.label}</div>
            <div className="text-xs mt-1 line-clamp-4 leading-relaxed">{data.label}</div>
        </div>
    )
}

export function DialecticTreeView({ tree }: DialecticTreeViewProps) {
    const nodes = useMemo<Node[]>(() => (tree?.nodes || []) as Node[], [tree])
    const edges = useMemo<Edge[]>(() => (tree?.edges || []) as Edge[], [tree])

    if (!tree || tree.nodes.length === 0) {
        return (
            <p className="text-sm text-ink-3 border-t border-line pt-4">第一轮结束后，这里会画出观点是怎么演变的。</p>
        )
    }

    return (
        <div className="h-[520px] rounded-lg border border-line bg-sunken/40">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={{ dialectic: DialecticNode }}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesDraggable={false}
                nodesConnectable={false}
                zoomOnScroll
            >
                <Background gap={22} size={1} color="var(--line-strong)" />
                <MiniMap pannable zoomable maskColor="color-mix(in srgb, var(--board) 70%, transparent)" nodeColor="var(--line-strong)" />
                <Controls />
            </ReactFlow>
        </div>
    )
}
