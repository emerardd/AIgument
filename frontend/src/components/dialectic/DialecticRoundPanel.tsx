import type { DialecticMessage } from '@/stores/dialecticStore'
import type { FallacyItem } from '@/types'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'

interface DialecticRoundPanelProps {
    round: number
    messages: DialecticMessage[]
    fallacies: FallacyItem[]
    showThinking: boolean
    showFallacies: boolean
}

function RoleCard({
    title,
    content,
    thinking,
    color,
}: {
    title: string
    content: string
    thinking?: Record<string, unknown>
    color: string
}) {
    return (
        <div className={`card-modern p-4 border-l-4 ${color}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">{title}</div>
            </div>
            <div className="text-sm leading-relaxed">
                {content ? <MarkdownRenderer content={content} /> : '内容生成中...'}
            </div>
            {thinking && (
                <div className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
                    <div className="font-medium text-foreground mb-1">思考摘要</div>
                    <pre className="whitespace-pre-wrap">
                        {JSON.stringify(thinking, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    )
}

export function DialecticRoundPanel({
    round,
    messages,
    fallacies,
    showThinking,
    showFallacies,
}: DialecticRoundPanelProps) {
    const thesis = messages.find(m => m.role === '正题')
    const antithesis = messages.find(m => m.role === '反题')
    const synthesis = messages.find(m => m.role === '合题')

    const thesisFallacies = fallacies.filter(f => f.side === 'thesis')
    const antithesisFallacies = fallacies.filter(f => f.side === 'antithesis')

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm font-medium text-muted-foreground px-3 py-1 rounded-full bg-muted/30">
                    第 {round} 轮
                </span>
                <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <RoleCard
                    title="正题"
                    content={thesis?.content || ''}
                    thinking={showThinking ? thesis?.thinking : undefined}
                    color="border-emerald-400"
                />
                <RoleCard
                    title="反题"
                    content={antithesis?.content || ''}
                    thinking={showThinking ? antithesis?.thinking : undefined}
                    color="border-amber-400"
                />
            </div>

            <RoleCard
                title="合题"
                content={synthesis?.content || ''}
                thinking={showThinking ? synthesis?.thinking : undefined}
                color="border-violet-400"
            />

            {showFallacies && (thesisFallacies.length > 0 || antithesisFallacies.length > 0) && (
                <div className="grid md:grid-cols-2 gap-4">
                    <FallacyList title="正题谬误" items={thesisFallacies} />
                    <FallacyList title="反题谬误" items={antithesisFallacies} />
                </div>
            )}
        </div>
    )
}

function FallacyList({ title, items }: { title: string; items: FallacyItem[] }) {
    if (items.length === 0) {
        return (
            <div className="p-3 rounded-lg bg-muted/20 text-xs text-muted-foreground">
                {title}: 未检测到明显谬误
            </div>
        )
    }

    return (
        <div className="p-3 rounded-lg bg-muted/20">
            <div className="text-xs font-semibold mb-2">{title}</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
                {items.map((f, idx) => (
                    <li key={`${f.type}-${idx}`} className="border border-border/50 rounded-md p-2 bg-background/60">
                        <div className="font-medium text-foreground">{f.type}</div>
                        <div className="mt-1">“{f.quote}”</div>
                        <div className="mt-1">{f.explanation}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider opacity-70">
                            {f.severity}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}
