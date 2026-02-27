import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useDebateStore } from '@/stores/debateStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { debateAPI } from '@/services/api'
import type { DebateSettings, StreamEvent } from '@/types'
import { CopyButton } from '@/components/ui/CopyButton'
import { Loader2, ThumbsUp, ThumbsDown, ArrowRight } from 'lucide-react'

export function DebateView() {
    const [inputTopic, setInputTopic] = useState('')
    const [rounds, setRounds] = useState(3)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const { messages, isLoading, error, addMessage, updateMessage, setLoading, setError, setTopic, clear } =
        useDebateStore()
    const { defaultProvider, defaultModel, streamMode } = useSettingsStore()

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
    }

    const handleStart = async () => {
        if (!inputTopic.trim()) return

        clear()
        setLoading(true)
        setError(null)
        setTopic(inputTopic)
        scrollToBottom()

        const settings: DebateSettings = {
            topic: inputTopic,
            rounds,
            provider: defaultProvider,
            model: defaultModel,
            stream: streamMode,
        }

        if (streamMode) {
            const messageMap = new Map<string, number>()

            debateAPI.streamDebate(
                settings,
                (event: StreamEvent) => {
                    if (event.type === 'content' && event.side && event.round !== undefined) {
                        const key = `${event.round}-${event.side}`
                        const msgIndex = messageMap.get(key)

                        if (msgIndex === undefined) {
                            const currentLength = useDebateStore.getState().messages.length
                            messageMap.set(key, currentLength)
                            addMessage({
                                role: event.side,
                                content: event.content || '',
                                round: event.round,
                            })
                        } else {
                            updateMessage(msgIndex, event.content || '')
                        }
                    } else if (event.type === 'complete') {
                        setLoading(false)
                    } else if (event.type === 'error') {
                        setError(event.message || event.error || '未知错误')
                        setLoading(false)
                    }
                },
                (err) => {
                    setError(err.message)
                    setLoading(false)
                }
            )
        } else {
            try {
                await debateAPI.createDebate(settings)
                setLoading(false)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : '未知错误')
                setLoading(false)
            }
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-12">
            {/* Topic Input Section */}
            <div className="space-y-6">
                <div className="text-center space-y-2 animate-fade-in">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">开始一场辩论</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">输入一个话题，让 AI 为你展示多角度的思维碰撞</p>
                </div>

                <div className="card-modern p-1 sm:p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-background/50 backdrop-blur-sm animate-scale-in delay-100 opacity-0">
                    <Input
                        placeholder="例如：远程办公是否应该成为常态？"
                        value={inputTopic}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputTopic(e.target.value)}
                        className="h-11 sm:h-12 border-0 bg-transparent focus-visible:ring-0 text-base sm:text-lg px-3 sm:px-4 shadow-none"
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleStart()}
                    />
                    <Button
                        onClick={handleStart}
                        disabled={isLoading || !inputTopic.trim()}
                        className="h-11 px-6 rounded-xl btn-primary shrink-0 w-full sm:w-auto transition-transform active:scale-95"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <ArrowRight className="h-5 w-5" />
                        )}
                    </Button>
                </div>

                {/* Settings Panel */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 animate-fade-in delay-200 opacity-0">
                    {/* Rounds Selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground font-medium">辩论轮次</span>
                        <div className="flex items-center bg-muted/30 rounded-xl p-1 gap-1">
                            {[
                                { n: 1, label: '快速', desc: '1轮' },
                                { n: 3, label: '标准', desc: '3轮' },
                                { n: 5, label: '深入', desc: '5轮' },
                            ].map(({ n, label, desc }) => (
                                <button
                                    key={n}
                                    onClick={() => setRounds(n)}
                                    className={`
                                        relative px-4 py-2 rounded-lg transition-all duration-300 text-sm font-medium
                                        flex flex-col items-center gap-0.5 min-w-[70px]
                                        ${rounds === n
                                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                                            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                        }
                                    `}
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
                                    onChange={(e) => {
                                        const v = Math.min(10, Math.max(1, Number(e.target.value) || 1))
                                        setRounds(v)
                                    }}
                                    className="w-12 h-8 text-center text-sm font-bold rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none"
                                />
                                <span className="text-xs text-muted-foreground">轮</span>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block w-px h-8 bg-border/50" />

                    {/* Model Info */}
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/20">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-muted-foreground">AI 模型</div>
                            <div className="text-sm font-medium text-foreground">{defaultModel}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="p-4 rounded-xl bg-destructive/5 text-destructive text-sm text-center animate-spring">
                    {error}
                </div>
            )}

            {/* Debate Messages */}
            <div className="space-y-6 sm:space-y-8">
                {messages.map((msg, idx: number) => {
                    const isPro = msg.role === '正方'
                    return (
                        <div
                            key={idx}
                            className={`flex gap-2 sm:gap-4 animate-slide-up ${isPro ? '' : 'flex-row-reverse'}`}
                        >
                            {/* Avatar */}
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm
                                ${isPro
                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                }
                            `}>
                                {isPro ? (
                                    <ThumbsUp className="w-4 h-4" />
                                ) : (
                                    <ThumbsDown className="w-4 h-4" />
                                )}
                            </div>

                            {/* Message Bubble */}
                            <div className={`
                                max-w-[90%] sm:max-w-[85%] space-y-2
                                ${isPro ? 'items-start' : 'items-end flex flex-col'}
                            `}>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                        {isPro ? '正方' : '反方'}
                                    </span>
                                    <span>·</span>
                                    <span>第 {msg.round} 轮</span>
                                </div>

                                <div className={`
                                    relative group card-modern p-5 text-sm leading-relaxed shadow-sm hover:shadow-md transition-shadow duration-300
                                    ${isPro
                                        ? 'rounded-tl-none border-l-2 border-l-blue-500'
                                        : 'rounded-tr-none border-r-2 border-r-orange-500'
                                    }
                                `}>
                                    {msg.content ? (
                                        <>
                                            <MarkdownRenderer content={msg.content} />
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <CopyButton text={msg.content} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>思考中...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Loading Indicator (Initial) */}
            {isLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground animate-fade-in">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-sm">正在准备辩论...</span>
                </div>
            )}
        </div>
    )
}
