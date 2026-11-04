import { useSearchParams } from 'react-router-dom'
import { AgentDebateView } from '@/components/debate/AgentDebateView'
import { DialecticView } from '@/components/dialectic/DialecticView'
import { Brain, GitBranch } from 'lucide-react'

type DebateMode = 'agent' | 'dialectic'

const MODES: Record<DebateMode, { label: string; title: string; subtitle: string; icon: typeof Brain }> = {
    agent: {
        label: '对抗辩论',
        title: '正反方 Agent 辩论',
        subtitle: '双方独立思考、选择策略并发言，评审逐轮打分并给出最终裁决。',
        icon: Brain,
    },
    dialectic: {
        label: '辩证推演',
        title: '正题 · 反题 · 合题',
        subtitle: '多轮辩证推进，实时生成合题与谬误标注，形成观点进化树。',
        icon: GitBranch,
    },
}

function parseDebateMode(value: string | null): DebateMode {
    return value === 'dialectic' ? 'dialectic' : 'agent'
}

export default function DebatePage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const mode = parseDebateMode(searchParams.get('mode'))
    const current = MODES[mode]

    const switchMode = (next: DebateMode) => {
        setSearchParams(next === 'agent' ? {} : { mode: next }, { replace: true })
    }

    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-14">
                <div className="text-center mb-8 sm:mb-10 space-y-4">
                    <div role="tablist" aria-label="辩论模式" className="inline-flex items-center bg-muted/40 rounded-xl p-1 gap-1">
                        {(Object.keys(MODES) as DebateMode[]).map((key) => {
                            const { label, icon: Icon } = MODES[key]
                            const active = key === mode
                            return (
                                <button
                                    key={key}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => switchMode(key)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active
                                        ? 'bg-background text-foreground shadow-soft-sm'
                                        : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        <span className="text-gradient">{current.title}</span>
                    </h1>
                    <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">{current.subtitle}</p>
                </div>

                {/* Both views stay mounted so switching tabs does not cancel a running session. */}
                <div hidden={mode !== 'agent'}><AgentDebateView /></div>
                <div hidden={mode !== 'dialectic'}><DialecticView /></div>
            </div>
        </div>
    )
}
