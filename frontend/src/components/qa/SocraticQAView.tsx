import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Square } from 'lucide-react'
import { Page } from '@/components/layout/Page'
import { TurnRail, type RailRound } from '@/components/session/TurnRail'
import { Utterance } from '@/components/session/Utterance'
import type { TopicHandoff } from '@/hooks/useInitialTopic'
import { useStreamRun } from '@/hooks/useStreamRun'
import { useSettingsStore } from '@/stores/settingsStore'
import { qaAPI } from '@/services/api'
import type { ChatHistoryItem, SocraticQAStreamEvent } from '@/services/api'

export interface SocraticRestoreState {
    restore: {
        sessionId: number
        mode?: string
        history: ChatHistoryItem[]
    }
}

interface QAMode {
    id: string
    name: string
    description: string
    icon: string
}

const MODE_ANSWER_LABEL: Record<string, string> = {
    socratic: '引导',
    structured: '回答',
    hybrid: '引导与回答',
}

export function SocraticQAView() {
    const location = useLocation()
    const navigate = useNavigate()
    // 从历史记录恢复会话（SessionDetailModal 通过路由 state 传入），只在挂载时读取一次
    const [restored] = useState(() => (location.state as SocraticRestoreState | null)?.restore ?? null)

    const [question, setQuestion] = useState(() => (location.state as TopicHandoff | null)?.topic ?? '')
    const [pending, setPending] = useState<string | null>(null)
    const [modes, setModes] = useState<QAMode[]>([])
    const [selectedMode, setSelectedMode] = useState(restored?.mode ?? 'hybrid')
    const [response, setResponse] = useState(
        () => [...(restored?.history ?? [])].reverse().find(item => item.role === 'assistant')?.content ?? ''
    )
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<ChatHistoryItem[]>(restored?.history ?? [])
    const [sessionId, setSessionId] = useState<number | null>(restored?.sessionId ?? null)
    const responseRef = useRef<HTMLDivElement>(null)
    const run = useStreamRun()
    const { defaultProvider, defaultModel } = useSettingsStore()

    // 清掉路由 state，刷新页面时不会再次恢复
    useEffect(() => {
        if (location.state) navigate(location.pathname, { replace: true, state: null })
    }, [location.state, location.pathname, navigate])

    // 获取可用模式
    useEffect(() => {
        qaAPI.getModes()
            .then((res) => setModes(res.data.modes || []))
            .catch(err => console.error('Failed to fetch modes:', err))
    }, [])

    // 自动滚动
    useEffect(() => {
        if (pending) responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, [response, pending])

    const askQuestion = () => {
        const asked = question.trim()
        if (!asked) {
            setError('请输入问题')
            return
        }

        setIsLoading(true)
        setResponse('')
        setError(null)
        setPending(asked)
        setQuestion('')

        let fullResponse = ''
        void run.start<SocraticQAStreamEvent>(
            (onEvent, onError, signal) => qaAPI.streamSocraticQA(
                asked,
                selectedMode as 'socratic' | 'structured' | 'hybrid',
                onEvent,
                onError,
                defaultProvider,
                defaultModel,
                history,
                sessionId ?? undefined,
                signal,
            ),
            {
                onEvent: (data) => {
                    if (data.type === 'session' && data.session_id) {
                        setSessionId(data.session_id)
                    } else if ((data.type === 'content' || data.type === 'complete') && data.content !== undefined) {
                        setResponse(data.content)
                        fullResponse = data.content
                    }
                },
                onFinish: (outcome, message) => {
                    setIsLoading(false)
                    setPending(null)
                    if (outcome === 'completed' && fullResponse) {
                        setHistory(prev => [
                            ...prev,
                            { role: 'user', content: asked },
                            { role: 'assistant', content: fullResponse },
                        ])
                    } else {
                        // Nothing was saved to the thread: give the question back so it can be retried.
                        setQuestion(asked)
                        if (outcome === 'failed' || outcome === 'truncated') setError(message || 'Unknown error')
                    }
                },
            },
        )
    }

    const cancelQuestion = () => run.cancel()

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            askQuestion()
        }
    }

    const clearHistory = () => {
        setHistory([])
        setResponse('')
        setQuestion('')
        setSessionId(null)
    }

    const turns = history.reduce<{ q: string; a: string }[]>((acc, item, i) => {
        if (item.role === 'user') acc.push({ q: item.content, a: history[i + 1]?.role === 'assistant' ? history[i + 1].content : '' })
        return acc
    }, [])

    const thread = [
        ...turns.map(t => ({ ...t, live: false })),
        ...(pending ? [{ q: pending, a: response, live: true }] : []),
    ]
    const rail: RailRound[] = thread.map((turn, i) => ({
        round: i + 1,
        turns: [{ target: `q${i + 1}`, voice: 'a', label: '回答', state: turn.live ? 'live' : 'done' }],
    }))

    return (
        <Page
            width="reading"
            title="问答"
            description="可以让它只用提问引导你，也可以直接要答案，或者两样都要。"
        >
            <div role="radiogroup" aria-label="回答方式" className="panel overflow-hidden grid grid-cols-3 divide-x divide-line mb-10">
                {modes.map(mode => {
                    const selected = selectedMode === mode.id
                    return (
                        <button
                            key={mode.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setSelectedMode(mode.id)}
                            className={`relative text-left px-3 sm:px-4 py-3 ${selected ? 'bg-pro-soft' : 'hover:bg-sunken/60'}`}
                        >
                            {selected && <span className="absolute inset-x-0 top-0 h-[2px] bg-ink" aria-hidden="true" />}
                            <span className={`block text-[0.9375rem] ${selected ? 'text-ink font-medium' : 'text-ink-2'}`}>{mode.name}</span>
                            <span className="hidden sm:block text-[0.8125rem] text-ink-3 mt-0.5 leading-snug">{mode.description}</span>
                        </button>
                    )
                })}
            </div>

            {(turns.length > 0 || pending) && (
                <>
                    <div className="sticky top-[60px] md:top-0 z-20 -mx-[clamp(16px,4vw,56px)] px-[clamp(16px,4vw,56px)] py-3 mb-8 bg-page/90 backdrop-blur-md border-b border-line">
                        <TurnRail label="问答进度" rounds={rail} />
                    </div>
                    <ol className="space-y-12 mb-12" aria-label="问答记录">
                        {thread.map((turn, i) => (
                            <li key={i} id={`q${i + 1}`} className="scroll-mt-40">
                                <p className="flex gap-3 font-serif text-[1.25rem] leading-snug font-semibold mb-4">
                                    <span className="numeral text-ink-3 font-normal shrink-0">{i + 1}</span>
                                    <span>{turn.q}</span>
                                </p>
                                <Utterance
                                    voice="a"
                                    align="center"
                                    speaker={MODE_ANSWER_LABEL[selectedMode] ?? '回答'}
                                    content={turn.a || undefined}
                                    streaming={turn.live}
                                />
                            </li>
                        ))}
                    </ol>
                </>
            )}

            {error && (
                <div className="mb-6 panel px-5 py-4 t-small" style={{ boxShadow: 'inset 3px 0 0 var(--danger), var(--shadow-card)' }} role="alert">{error}</div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); if (isLoading) cancelQuestion(); else askQuestion() }}>
                <label htmlFor="qa-question" className="block text-sm text-ink-3 mb-2">
                    {turns.length ? '接着问' : '你的问题'}
                </label>
                <div className="field px-4 pt-3 pb-2">
                    <textarea
                        id="qa-question"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={turns.length ? '可以回答它提的问题，或者问得更深一点' : '例如：为什么天空是蓝色的？'}
                        className="w-full resize-none text-[1.0625rem] placeholder:text-ink-3 leading-relaxed"
                        rows={3}
                        disabled={isLoading}
                    />
                    <div className="flex items-center justify-between gap-3 pt-2">
                        <span className="text-[0.8125rem] text-ink-3">Enter 发送，Shift+Enter 换行</span>
                        <div className="flex items-center gap-2">
                            {turns.length > 0 && !isLoading && (
                                <button type="button" onClick={clearHistory} className="btn-line h-9">重新开始</button>
                            )}
                            <button type="submit" disabled={!isLoading && !question.trim()} className="btn-ink h-9">
                                {isLoading ? <><Square className="h-3.5 w-3.5" fill="currentColor" />停止</> : '发送'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
            <div ref={responseRef} />
        </Page>
    )
}
