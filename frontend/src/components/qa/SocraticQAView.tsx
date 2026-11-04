import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Brain, Lightbulb, BookOpen, HelpCircle, Send, RefreshCw, ChevronRight, Sparkles, Square } from 'lucide-react'
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

const MODE_ICONS: Record<string, React.ReactNode> = {
    socratic: <HelpCircle className="w-5 h-5" />,
    structured: <BookOpen className="w-5 h-5" />,
    hybrid: <Sparkles className="w-5 h-5" />
}

export function SocraticQAView() {
    const location = useLocation()
    const navigate = useNavigate()
    // 从历史记录恢复会话（SessionDetailModal 通过路由 state 传入），只在挂载时读取一次
    const [restored] = useState(() => (location.state as SocraticRestoreState | null)?.restore ?? null)

    const [question, setQuestion] = useState('')
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
        responseRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [response])

    const askQuestion = () => {
        const asked = question.trim()
        if (!asked) {
            setError('请输入问题')
            return
        }

        setIsLoading(true)
        setResponse('')
        setError(null)

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
                    if (outcome === 'completed' && fullResponse) {
                        setHistory(prev => [
                            ...prev,
                            { role: 'user', content: asked },
                            { role: 'assistant', content: fullResponse },
                        ])
                    } else if (outcome === 'failed' || outcome === 'truncated') {
                        setError(message || 'Unknown error')
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

    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
                {/* 头部 */}
                <div className="text-center mb-8 sm:mb-12">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in">
                        <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>苏格拉底问答</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight animate-slide-up delay-100 opacity-0">
                        <span className="text-gradient">引导式</span>
                        <br />
                        <span className="text-foreground/80">深度学习</span>
                    </h1>

                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up delay-200 opacity-0 px-4 sm:px-0">
                        通过提问引导你思考，而不是直接给答案
                    </p>
                </div>

                {/* 模式选择 */}
                <div className="grid grid-cols-3 gap-4 mb-6 max-w-3xl mx-auto animate-fade-in delay-200 opacity-0">
                    {modes.map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setSelectedMode(mode.id)}
                            className={`
                                p-4 rounded-xl border transition-all text-left
                                ${selectedMode === mode.id
                                    ? 'bg-primary/10 border-primary ring-2 ring-primary/20'
                                    : 'bg-card border-border hover:border-primary/50'
                                }
                            `}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className={selectedMode === mode.id ? 'text-primary' : 'text-muted-foreground'}>
                                    {MODE_ICONS[mode.id] || <Lightbulb className="w-5 h-5" />}
                                </span>
                                <span className="font-medium text-sm">{mode.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{mode.description}</p>
                        </button>
                    ))}
                </div>

                {/* 输入区域 */}
                <div className="card-modern p-6 mb-6 max-w-3xl mx-auto">
                    <div className="relative">
                        <textarea
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入你的问题，例如：什么是机器学习？为什么天空是蓝色的？"
                            className="w-full px-4 py-3 pr-12 rounded-xl bg-muted/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                            rows={3}
                            disabled={isLoading}
                        />
                        <button
                            onClick={isLoading ? cancelQuestion : askQuestion}
                            disabled={!isLoading && !question.trim()}
                            className="absolute right-3 bottom-3 p-2.5 rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isLoading ? '停止生成' : '发送'}
                        >
                            {isLoading ? (
                                <Square className="w-5 h-5" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    {history.length > 0 && (
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span>已有 {history.length / 2} 轮对话</span>
                            <button
                                onClick={clearHistory}
                                className="hover:text-foreground transition-colors"
                            >
                                清除历史
                            </button>
                        </div>
                    )}
                </div>

                {/* 错误提示 */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
                        {error}
                    </div>
                )}

                {/* 回复区域 */}
                {response && (
                    <div className="card-modern overflow-hidden max-w-3xl mx-auto">
                        <div className="px-6 py-4 border-b bg-primary/5">
                            <div className="flex items-center gap-2">
                                {MODE_ICONS[selectedMode]}
                                <span className="font-medium">
                                    {selectedMode === 'socratic' ? '引导思考' :
                                        selectedMode === 'structured' ? '结构化知识' :
                                            '混合回答'}
                                </span>
                                {isLoading && (
                                    <RefreshCw className="w-4 h-4 animate-spin ml-auto text-muted-foreground" />
                                )}
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ResponseRenderer content={response} />
                            </div>
                        </div>

                        <div ref={responseRef} />
                    </div>
                )}

                {/* 对话历史 */}
                {history.length > 2 && (
                    <details className="mt-6 p-4 rounded-xl bg-muted/30">
                        <summary className="text-sm font-medium cursor-pointer">
                            查看对话历史 ({history.length / 2} 轮)
                        </summary>
                        <div className="mt-4 space-y-4">
                            {history.slice(0, -2).map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`text-sm ${msg.role === 'user' ? 'text-muted-foreground' : ''}`}
                                >
                                    <span className="font-medium">
                                        {msg.role === 'user' ? '你: ' : 'AI: '}
                                    </span>
                                    <span className="line-clamp-2">{msg.content}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}

                {/* 空状态 */}
                {!response && !isLoading && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>选择一个模式，然后提出你的问题</p>
                        <p className="text-sm mt-2">
                            💡 苏格拉底式：引导你自己思考答案<br />
                            📋 结构化：给你系统的知识卡片<br />
                            🔄 混合：两者结合
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

// 回复内容渲染器
function ResponseRenderer({ content }: { content: string }) {
    // 简单渲染，将 Markdown 风格转为 HTML
    const formatContent = (text: string) => {
        return text
            .split('\n')
            .map((line, idx) => {
                // 处理标题
                if (line.startsWith('###')) {
                    return <h4 key={idx} className="font-bold mt-4 mb-2">{line.replace(/^###\s*/, '')}</h4>
                }
                if (line.startsWith('##')) {
                    return <h3 key={idx} className="font-bold text-lg mt-4 mb-2">{line.replace(/^##\s*/, '')}</h3>
                }
                if (line.startsWith('#')) {
                    return <h2 key={idx} className="font-bold text-xl mt-4 mb-2">{line.replace(/^#\s*/, '')}</h2>
                }

                // 处理引导问题（以数字或问号开头）
                if (/^\d+[.)]/.test(line) || line.includes('？') || line.includes('?')) {
                    return (
                        <div key={idx} className="flex items-start gap-2 my-2 p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                            <span>{line}</span>
                        </div>
                    )
                }

                // 处理列表
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    return (
                        <li key={idx} className="ml-4 my-1">
                            {line.replace(/^[-*]\s*/, '')}
                        </li>
                    )
                }

                // 处理分隔线
                if (line.trim() === '---') {
                    return <hr key={idx} className="my-4 border-border" />
                }

                // 普通段落
                if (line.trim()) {
                    return <p key={idx} className="my-2">{line}</p>
                }

                return null
            })
    }

    return <>{formatContent(content)}</>
}
