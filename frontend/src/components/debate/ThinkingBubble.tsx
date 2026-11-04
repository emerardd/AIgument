import { useState } from 'react'
import type { AgentThinking } from '@/types'
import { ChevronDown } from 'lucide-react'

const STRATEGY_NAMES: Record<string, string> = {
    direct_refute: '直接反驳',
    evidence_attack: '质疑证据',
    reframe: '重新定义问题',
    counter_example: '举出反例',
    consequence: '推演后果',
    strengthen: '巩固己方',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[0.75rem] text-ink-3 mb-0.5">{title}</div>
            <div className="text-[0.8125rem] text-ink-2 leading-relaxed">{children}</div>
        </div>
    )
}

function List({ items }: { items?: string[] }) {
    if (!items?.length) return null
    return <ul className="list-disc pl-4 space-y-0.5 marker:text-ink-3">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
}

/** A side's private reasoning before it speaks, folded by default. */
export function ThinkingBubble({ thinking }: { thinking: AgentThinking }) {
    const [open, setOpen] = useState(false)
    const c = thinking.content
    if (!c || Object.keys(c).length === 0) return null

    const strategy = c.selected_strategy ? STRATEGY_NAMES[c.selected_strategy] ?? c.selected_strategy : null

    return (
        <div className="text-left">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-3 hover:text-ink"
            >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                思路{strategy ? `：${strategy}` : ''}
                <span className="tabular-nums">（把握 {Math.round(thinking.confidence * 100)}%）</span>
            </button>

            {open && (
                <div className="mt-2 pl-5 border-l border-line space-y-2.5">
                    {c.topic_analysis && <Section title="对辩题的理解">{c.topic_analysis}</Section>}
                    {c.core_stance && <Section title="核心立场">{c.core_stance}</Section>}
                    {c.opponent_weaknesses?.length ? <Section title="对方的漏洞"><List items={c.opponent_weaknesses} /></Section> : null}
                    {c.counter_points?.length ? <Section title="准备反驳"><List items={c.counter_points} /></Section> : null}
                    {c.new_arguments?.length ? <Section title="新论点"><List items={c.new_arguments} /></Section> : null}
                    {c.key_arguments?.length ? <Section title="主要论点"><List items={c.key_arguments} /></Section> : null}
                    {c.strategy_reason && <Section title="为什么这样打">{c.strategy_reason}</Section>}
                </div>
            )}
        </div>
    )
}
