import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useSettingsStore } from '@/stores/settingsStore'
import { qaAPI } from '@/services/api'
import { CopyButton } from '@/components/ui/CopyButton'
import { Loader2, Send, Trash2, BookOpen, Zap, Brain, Sparkles, ArrowUp } from 'lucide-react'

interface QAMessage {
    role: 'user' | 'assistant'
    content: string
}

type QAStyle = 'comprehensive' | 'concise' | 'socratic'

export function QAView() {
    const [question, setQuestion] = useState('')
    const [messages, setMessages] = useState<QAMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [style, setStyle] = useState<QAStyle>('comprehensive')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const { defaultProvider, defaultModel, streamMode } = useSettingsStore()

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
    }

    const styleOptions = [
        {
            value: 'comprehensive' as const,
            label: '全面分析',
            icon: BookOpen,
            description: '多角度深入分析',
        },
        {
            value: 'concise' as const,
            label: '简洁回答',
            icon: Zap,
            description: '直奔主题要点',
        },
        {
            value: 'socratic' as const,
            label: '苏格拉底',
            icon: Brain,
            description: '引导式思考',
        },
    ]

    const handleSubmit = async () => {
        if (!question.trim() || isLoading) return

        const userQuestion = question.trim()
        setMessages(prev => [...prev, { role: 'user', content: userQuestion }])
        setQuestion('')
        setIsLoading(true)
        setError(null)
        scrollToBottom()

        setMessages(prev => [...prev, { role: 'assistant', content: '' }])

        if (streamMode) {
            await qaAPI.streamQA(
                userQuestion,
                (event) => {
                    if (event.type === 'content' && event.content) {
                        setMessages(prev => {
                            const updated = [...prev]
                            updated[updated.length - 1] = { role: 'assistant', content: event.content! }
                            return updated
                        })
                    } else if (event.type === 'complete') {
                        setIsLoading(false)
                    } else if (event.type === 'error') {
                        setError('回答生成出错')
                        setIsLoading(false)
                    }
                },
                (err) => {
                    setError(err.message)
                    setIsLoading(false)
                },
                style,
                defaultProvider,
                defaultModel
            )
        } else {
            try {
                const response = await qaAPI.askQuestion(
                    userQuestion,
                    style,
                    defaultProvider,
                    defaultModel
                )
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: response.data.answer }
                    return updated
                })
                setIsLoading(false)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : '未知错误')
                setIsLoading(false)
            }
        }

        inputRef.current?.focus()
    }

    const handleClear = () => {
        setMessages([])
        setError(null)
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Style Selection - Minimalist */}
            <div className="flex justify-center animate-fade-in">
                <div className="inline-flex bg-muted/50 p-1 rounded-xl">
                    {styleOptions.map((option) => {
                        const Icon = option.icon
                        const isSelected = style === option.value
                        return (
                            <button
                                key={option.value}
                                onClick={() => setStyle(option.value)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                                    ${isSelected
                                        ? 'bg-background text-foreground shadow-sm scale-105'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{option.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Q&A Area */}
            <div className="min-h-[500px] flex flex-col gap-6">
                <div className="flex-1 space-y-8">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center animate-fade-in space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center animate-scale-in delay-100 opacity-0">
                                <Sparkles className="w-8 h-8 text-primary/60" />
                            </div>
                            <div className="animate-slide-up delay-200 opacity-0">
                                <h3 className="text-lg font-semibold text-foreground">有什么想问的？</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    选择一种风格，开始探索
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`animate-slide-up flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                {/* Avatar */}
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm
                                    ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                    }
                                `}>
                                    {msg.role === 'user' ? (
                                        <ArrowUp className="w-4 h-4" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                </div>

                                {/* Message Bubble */}
                                <div className={`max-w-[85%] space-y-1 ${msg.role === 'user' ? 'items-end flex flex-col' : 'items-start'}`}>
                                    <div className="text-xs text-muted-foreground px-1">
                                        {msg.role === 'user' ? '你' : 'AI 助手'}
                                    </div>
                                    <div className={`
                                        relative group p-4 text-sm leading-relaxed rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300
                                        ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                                            : 'card-modern rounded-tl-none'
                                        }
                                    `}>
                                        {msg.content ? (
                                            msg.role === 'user' ? (
                                                <p>{msg.content}</p>
                                            ) : (
                                                <>
                                                    <MarkdownRenderer content={msg.content} />
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <CopyButton text={msg.content} />
                                                    </div>
                                                </>
                                            )
                                        ) : (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span>思考中...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="p-3 rounded-xl bg-destructive/5 text-destructive text-sm text-center animate-spring">
                        {error}
                    </div>
                )}

                {/* Input Area - Floating */}
                <div className="sticky bottom-6 animate-slide-up delay-300 opacity-0">
                    <div className="card-modern p-2 flex items-center gap-2 bg-background/80 backdrop-blur-md shadow-soft-lg hover:shadow-soft-xl transition-shadow duration-300">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClear}
                            disabled={messages.length === 0 || isLoading}
                            className="rounded-xl text-muted-foreground hover:text-foreground shrink-0 w-10 h-10 hover:bg-muted/50"
                            title="清空对话"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Input
                            ref={inputRef}
                            placeholder="输入你的问题..."
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                            disabled={isLoading}
                            className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-base shadow-none h-10"
                        />
                        <Button
                            onClick={handleSubmit}
                            disabled={!question.trim() || isLoading}
                            className="rounded-xl btn-primary shrink-0 w-10 h-10 p-0 transition-transform active:scale-90"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
