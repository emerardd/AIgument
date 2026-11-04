import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { useSettingsStore, type Provider } from '@/stores/settingsStore'
import { presetTopics } from '@/config/presetTopics'
import { modelPresets } from '@/config/modelPresets'
import type { DebateSettings } from '@/types'
import { ArrowRight, Brain, Eye, EyeOff, ListChecks, Settings2, Shuffle, Square, ThumbsDown, ThumbsUp } from 'lucide-react'

const PROVIDERS: { id: Provider; label: string }[] = [
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'claude', label: 'Claude' },
    { id: 'mock', label: 'Mock' },
]

const ROUND_PRESETS = [
    { n: 1, label: '快速', desc: '1轮' },
    { n: 3, label: '标准', desc: '3轮' },
    { n: 5, label: '深入', desc: '5轮' },
]

interface SideModel {
    provider: Provider
    model: string
}

function SideModelPicker({ side, value, onChange }: {
    side: 'pro' | 'con'
    value: SideModel
    onChange: (value: SideModel) => void
}) {
    const isPro = side === 'pro'
    const Icon = isPro ? ThumbsUp : ThumbsDown
    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${isPro ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
            <Icon className={`w-3 h-3 ${isPro ? 'text-blue-500' : 'text-orange-500'}`} />
            <span className={`text-xs font-medium ${isPro ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {isPro ? '正方' : '反方'}
            </span>
            <select
                value={value.provider}
                onChange={(e) => {
                    const provider = e.target.value as Provider
                    onChange({ provider, model: modelPresets[provider][0] })
                }}
                className="text-xs bg-transparent border-0 outline-none text-foreground cursor-pointer"
                aria-label={`${isPro ? '正方' : '反方'}提供商`}
            >
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select
                value={value.model}
                onChange={(e) => onChange({ ...value, model: e.target.value })}
                className="text-xs bg-transparent border-0 outline-none text-foreground cursor-pointer max-w-[120px]"
                aria-label={`${isPro ? '正方' : '反方'}模型`}
            >
                {modelPresets[value.provider].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        </div>
    )
}

function ToggleChip({ active, onClick, icon: Icon, label }: {
    active: boolean
    onClick: () => void
    icon: typeof Brain
    label: string
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${active
                ? 'bg-primary/10 text-primary'
                : 'bg-muted/30 text-muted-foreground hover:text-foreground'}`}
        >
            <Icon className="w-3 h-3" />
            {label}
            {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
    )
}

interface AgentDebateFormProps {
    isLoading: boolean
    onStart: (settings: DebateSettings) => void
    onCancel: () => void
}

export function AgentDebateForm({ isLoading, onStart, onCancel }: AgentDebateFormProps) {
    const [topic, setTopic] = useState('')
    const [rounds, setRounds] = useState(3)
    const [mixedMode, setMixedMode] = useState(false)
    const [pro, setPro] = useState<SideModel>({ provider: 'deepseek', model: modelPresets.deepseek[0] })
    const [con, setCon] = useState<SideModel>({ provider: 'openai', model: modelPresets.openai[0] })
    const [showTopics, setShowTopics] = useState(false)

    const { defaultProvider, defaultModel } = useSettingsStore()
    const { showThinking, showScores, toggleShowThinking, toggleShowScores } = useAgentDebateStore()

    const submit = () => {
        const trimmed = topic.trim()
        if (!trimmed || isLoading) return
        onStart({
            topic: trimmed,
            rounds,
            provider: defaultProvider,
            model: defaultModel,
            ...(mixedMode ? {
                pro_provider: pro.provider,
                pro_model: pro.model,
                con_provider: con.provider,
                con_model: con.model,
            } : {}),
        })
    }

    return (
        <div className="space-y-6">
            <div className="card-modern p-1 sm:p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-background/50 backdrop-blur-sm relative">
                <Input
                    placeholder="例如：人工智能是否会取代人类工作？"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="h-11 sm:h-12 border-0 bg-transparent focus-visible:ring-0 text-base sm:text-lg px-3 sm:px-4 shadow-none"
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
                <button
                    onClick={() => setShowTopics(!showTopics)}
                    className="h-11 px-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                    title="热门主题"
                >
                    <ListChecks className="h-5 w-5" />
                </button>
                <Button
                    onClick={isLoading ? onCancel : submit}
                    disabled={!isLoading && !topic.trim()}
                    className="h-11 px-6 rounded-xl btn-primary shrink-0 w-full sm:w-auto transition-transform active:scale-95"
                    title={isLoading ? '停止生成' : '开始辩论'}
                >
                    {isLoading ? <Square className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                </Button>

                {showTopics && (
                    <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl p-4 bg-background border border-border shadow-2xl z-50 max-h-80 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {presetTopics.map((cat) => (
                                <div key={cat.name}>
                                    <div className="text-xs font-medium text-muted-foreground mb-2">
                                        {cat.icon} {cat.name}
                                    </div>
                                    <div className="space-y-1">
                                        {cat.topics.map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => {
                                                    setTopic(t)
                                                    setShowTopics(false)
                                                }}
                                                className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-muted/50 text-foreground/80 hover:text-foreground transition-colors truncate"
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground font-medium">辩论轮次</span>
                    <div className="flex items-center bg-muted/30 rounded-xl p-1 gap-1">
                        {ROUND_PRESETS.map(({ n, label, desc }) => (
                            <button
                                key={n}
                                onClick={() => setRounds(n)}
                                className={`relative px-4 py-2 rounded-lg transition-all duration-300 text-sm font-medium flex flex-col items-center gap-0.5 min-w-[70px] ${rounds === n
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
                            >
                                <span className="text-xs opacity-80">{label}</span>
                                <span className="font-bold">{desc}</span>
                            </button>
                        ))}
                        <div className="flex items-center gap-1 px-2">
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={rounds}
                                onChange={(e) => setRounds(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                                className="w-12 h-8 text-center text-sm font-bold rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none"
                                aria-label="自定义轮数"
                            />
                            <span className="text-xs text-muted-foreground">轮</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <ToggleChip active={showThinking} onClick={toggleShowThinking} icon={Brain} label="思考过程" />
                    <ToggleChip active={showScores} onClick={toggleShowScores} icon={Settings2} label="评分面板" />
                </div>

                <div className="flex flex-wrap justify-center items-center gap-3">
                    <button
                        onClick={() => setMixedMode(!mixedMode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${mixedMode
                            ? 'bg-gradient-to-r from-blue-500/20 to-orange-500/20 text-primary border border-primary/30'
                            : 'bg-muted/30 text-muted-foreground hover:text-foreground'}`}
                    >
                        <Shuffle className="w-3 h-3" />
                        混合模型
                    </button>

                    {mixedMode ? (
                        <div className="flex flex-wrap gap-2 items-center">
                            <SideModelPicker side="pro" value={pro} onChange={setPro} />
                            <span className="text-xs text-muted-foreground font-bold">VS</span>
                            <SideModelPicker side="con" value={con} onChange={setCon} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/20">
                            <div className="text-left">
                                <div className="text-xs text-muted-foreground">AI 模型</div>
                                <div className="text-sm font-medium text-foreground">{defaultModel}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
