import { useState, useEffect, useRef } from 'react'
import { Brain, Lightbulb, BookOpen, HelpCircle, Send, RefreshCw, ChevronRight, Sparkles } from 'lucide-react'

interface QAMode {
    id: string
    name: string
    description: string
    icon: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const MODE_ICONS: Record<string, React.ReactNode> = {
    socratic: <HelpCircle className="w-5 h-5" />,
    structured: <BookOpen className="w-5 h-5" />,
    hybrid: <Sparkles className="w-5 h-5" />
}

export function SocraticQAView() {
    const [question, setQuestion] = useState('')
    const [modes, setModes] = useState<QAMode[]>([])
    const [selectedMode, setSelectedMode] = useState('hybrid')
    const [response, setResponse] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [_sessionId, setSessionId] = useState<number | null>(null)
    const [history, setHistory] = useState<Array<{ role: string; content: string }>>([])
    const responseRef = useRef<HTMLDivElement>(null)

    // 获取可用模式
    useEffect(() => {
        fetch(`${API_URL}/api/qa/modes`)
            .then(res => res.json())
            .then(data => setModes(data.modes || []))
            .catch(err => console.error('Failed to fetch modes:', err))
    }, [])

    // 自动滚动
    useEffect(() => {
        responseRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [response])

    const askQuestion = async () => {
        if (!question.trim()) {
            setError('请输入问题')
            return
        }

        setIsLoading(true)
        setResponse('')
        setError(null)

        try {
            const historyParam = encodeURIComponent(JSON.stringify(history))
            const url = `${API_URL}/api/qa/socratic-stream?question=${encodeURIComponent(question)}&mode=${selectedMode}&history=${historyParam}`

            const res = await fetch(url)
            const reader = res.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('Failed to get reader')
            }

            let fullResponse = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value)
                const lines = text.split('\n')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))

                            if (data.type === 'session') {
                                setSessionId(data.session_id)
                            } else if (data.type === 'content') {
                                setResponse(data.content)
                                fullResponse = data.content
                            } else if (data.type === 'complete') {
                                fullResponse = data.content
                            } else if (data.type === 'error') {
                                setError(data.error)
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            // 更新历史
            if (fullResponse) {
                setHistory(prev => [
                    ...prev,
                    { role: 'user', content: question },
                    { role: 'assistant', content: fullResponse }
                ])
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            askQuestion()
        }
    }

    const clearHistory = () => {
        setHistory([])
        setResponse('')
        setSessionId(null)
        setQuestion('')
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-green-500/5">
            <div className="container max-w-4xl mx-auto px-4 py-8">
                {/* 头部 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 mb-4">
                        <Brain className="w-5 h-5 text-green-500" />
                        <span className="font-medium text-green-600">苏格拉底问答</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-2">引导式学习</h1>
                    <p className="text-muted-foreground">
                        通过提问引导你思考，而不是直接给答案
                    </p>
                </div>

                {/* 模式选择 */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {modes.map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setSelectedMode(mode.id)}
                            className={`
                                p-4 rounded-xl border transition-all text-left
                                ${selectedMode === mode.id
                                    ? 'bg-green-500/10 border-green-500 ring-2 ring-green-500/20'
                                    : 'bg-card border-border hover:border-green-500/50'
                                }
                            `}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className={selectedMode === mode.id ? 'text-green-500' : 'text-muted-foreground'}>
                                    {MODE_ICONS[mode.id] || <Lightbulb className="w-5 h-5" />}
                                </span>
                                <span className="font-medium text-sm">{mode.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{mode.description}</p>
                        </button>
                    ))}
                </div>

                {/* 输入区域 */}
                <div className="bg-card rounded-2xl border shadow-sm p-6 mb-6">
                    <div className="relative">
                        <textarea
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入你的问题，例如：什么是机器学习？为什么天空是蓝色的？"
                            className="w-full px-4 py-3 pr-12 rounded-xl bg-muted/50 border border-border focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all resize-none"
                            rows={3}
                            disabled={isLoading}
                        />
                        <button
                            onClick={askQuestion}
                            disabled={isLoading || !question.trim()}
                            className="absolute right-3 bottom-3 p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isLoading ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
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
                    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b bg-green-500/5">
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
                                <ResponseRenderer content={response} mode={selectedMode} />
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
function ResponseRenderer({ content, mode: _mode }: { content: string; mode: string }) {
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
                if (/^\d+[\.\)]/.test(line) || line.includes('？') || line.includes('?')) {
                    return (
                        <div key={idx} className="flex items-start gap-2 my-2 p-3 rounded-lg bg-green-500/5 border-l-2 border-green-500">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
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
