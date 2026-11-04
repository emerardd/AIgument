import { useState } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { useSettingsStore, type Provider } from '@/stores/settingsStore'
import { useInitialTopic } from '@/hooks/useInitialTopic'
import { presetTopics } from '@/config/presetTopics'
import { modelPresets } from '@/config/modelPresets'
import type { DebateSettings } from '@/types'
import { ListChecks, Square } from 'lucide-react'

const PROVIDERS: { id: Provider; label: string }[] = [
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'claude', label: 'Claude' },
    { id: 'mock', label: 'Mock' },
]

const ROUND_OPTIONS = [1, 3, 5]

interface SideModel {
    provider: Provider
    model: string
}

function SideModelPicker({ side, value, onChange }: {
    side: 'pro' | 'con'
    value: SideModel
    onChange: (value: SideModel) => void
}) {
    const label = side === 'pro' ? '正方' : '反方'
    return (
        <div className="flex items-center gap-2 min-w-0">
            <span className={`stone stone-${side}`} aria-hidden="true" />
            <span className="text-sm text-ink-2 shrink-0">{label}</span>
            <select
                value={value.provider}
                onChange={(e) => {
                    const provider = e.target.value as Provider
                    onChange({ provider, model: modelPresets[provider][0] })
                }}
                className="field h-8 px-2 text-sm"
                aria-label={`${label}提供商`}
            >
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select
                value={value.model}
                onChange={(e) => onChange({ ...value, model: e.target.value })}
                className="field h-8 px-2 text-sm min-w-0 max-w-[11rem]"
                aria-label={`${label}模型`}
            >
                {modelPresets[value.provider].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        </div>
    )
}

interface AgentDebateFormProps {
    isLoading: boolean
    onStart: (settings: DebateSettings) => void
    onCancel: () => void
}

export function AgentDebateForm({ isLoading, onStart, onCancel }: AgentDebateFormProps) {
    const initialTopic = useInitialTopic()
    const [topic, setTopic] = useState(initialTopic)
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
        <form
            className="space-y-5"
            onSubmit={(e) => { e.preventDefault(); if (isLoading) onCancel(); else submit() }}
        >
            <div className="relative">
                <label htmlFor="debate-topic" className="block text-sm text-ink-3 mb-2">辩题</label>
                <div className="field flex items-center gap-2 pl-4 pr-1.5 py-1.5">
                    <input
                        id="debate-topic"
                        placeholder="例如：人工智能是否会取代人类工作？"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="flex-1 min-w-0 h-10 text-[1.0625rem] placeholder:text-ink-3"
                        autoComplete="off"
                    />
                    <button
                        type="button"
                        onClick={() => setShowTopics(!showTopics)}
                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded text-ink-3 hover:text-ink hover:bg-sunken"
                        title="题库"
                        aria-label="从题库选择"
                        aria-expanded={showTopics}
                    >
                        <ListChecks className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    </button>
                    <button
                        type="submit"
                        disabled={!isLoading && !topic.trim()}
                        className="btn-ink shrink-0"
                    >
                        {isLoading ? <><Square className="h-3.5 w-3.5" fill="currentColor" />停止</> : '开始辩论'}
                    </button>
                </div>

                {showTopics && (
                    <div className="absolute top-full left-0 right-0 mt-2 panel p-4 z-30 max-h-80 overflow-y-auto shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            {presetTopics.map((cat) => (
                                <div key={cat.name}>
                                    <div className="text-[0.8125rem] text-ink-3 mb-1">{cat.name}</div>
                                    {cat.topics.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => { setTopic(t); setShowTopics(false) }}
                                            className="block w-full text-left text-sm px-2 py-1.5 -mx-2 rounded text-ink-2 hover:text-ink hover:bg-sunken truncate"
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-ink-3">轮数</span>
                    <div className="segmented" role="group" aria-label="轮数">
                        {ROUND_OPTIONS.map(n => (
                            <button key={n} type="button" aria-pressed={rounds === n} onClick={() => setRounds(n)}>
                                {n}
                            </button>
                        ))}
                    </div>
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={rounds}
                        onChange={(e) => setRounds(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                        className="field w-14 h-8 text-center text-sm tabular-nums"
                        aria-label="自定义轮数"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button type="button" className="chip" aria-pressed={showThinking} onClick={toggleShowThinking}>思路</button>
                    <button type="button" className="chip" aria-pressed={showScores} onClick={toggleShowScores}>评分</button>
                    <button type="button" className="chip" aria-pressed={mixedMode} onClick={() => setMixedMode(!mixedMode)}>双方用不同模型</button>
                </div>

                {!mixedMode && (
                    <span className="text-sm text-ink-3">
                        双方均使用 <span className="text-ink-2">{defaultModel}</span>
                    </span>
                )}
            </div>

            {mixedMode && (
                <div className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
                    <SideModelPicker side="pro" value={pro} onChange={setPro} />
                    <SideModelPicker side="con" value={con} onChange={setCon} />
                </div>
            )}
        </form>
    )
}
