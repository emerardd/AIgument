import { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import type { DialecticTree } from '@/types'

interface DialecticTreeViewProps {
    tree: DialecticTree | null
}

function DialecticNode({ data }: { data: { label: string; kind: string; round: number } }) {
    const kind = data.kind
    const color =
        kind === 'thesis'
            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
            : kind === 'antithesis'
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-violet-400 bg-violet-50 text-violet-700'

    return (
        <div className={`min-w-[180px] max-w-[220px] border rounded-lg p-3 shadow-sm ${color}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-70">
                {kind} · 第{data.round}轮
            </div>
            <div className="text-xs font-medium mt-1 line-clamp-4">
                {data.label}
            </div>
        </div>
    )
}

export function DialecticTreeView({ tree }: DialecticTreeViewProps) {
    const nodes = useMemo<Node[]>(() => (tree?.nodes || []) as Node[], [tree])
    const edges = useMemo<Edge[]>(() => (tree?.edges || []) as Edge[], [tree])

    if (!tree || tree.nodes.length === 0) {
        return (
            <div className="p-4 rounded-xl bg-muted/20 text-sm text-muted-foreground text-center">
                暂无观点进化树
            </div>
        )
    }

    return (
        <div className="h-[520px] rounded-xl border border-border/50 bg-background/60">
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
                <Background gap={18} size={1} />
                <MiniMap />
                <Controls />
            </ReactFlow>
        </div>
    )
}
