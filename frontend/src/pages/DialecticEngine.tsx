import { useState, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDialecticStore } from '@/stores/dialecticStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { dialecticAPI } from '@/services/api'
import { DialecticRoundPanel } from '@/components/dialectic/DialecticRoundPanel'
import { DialecticTreeView } from '@/components/dialectic/DialecticTreeView'
import type { DialecticStreamEvent, FallacyItem, DialecticTree } from '@/types'
import { Brain, GitBranch, Eye, EyeOff, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'

export default function DialecticEngine() {
    const [inputTopic, setInputTopic] = useState('')
    const [rounds, setRounds] = useState(5)
    const bottomRef = useRef<HTMLDivElement>(null)

    const {
        messages,
        fallaciesByRound,
        tree,
        currentRound,
        isLoading,
        error,
        showThinking,
        showFallacies,
        setTopic,
        setSessionId,
        setRounds: setStoreRounds,
        setCurrentRound,
        setLoading,
        setError,
        addMessage,
        setFallacies,
        setTree,
        toggleThinking,
        toggleFallacies,
        clear,
    } = useDialecticStore()

    const { defaultProvider, defaultModel } = useSettingsStore()

    const scrollToBottom = useCallback(() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }, [])

    const handleStart = async () => {
        if (!inputTopic.trim()) return

        clear()
        setLoading(true)
        setError(null)
        setTopic(inputTopic)
        setStoreRounds(rounds)
        scrollToBottom()

        const settings = {
            topic: inputTopic,
            rounds,
            provider: defaultProvider,
            model: defaultModel,
            stream: true,
        }

        dialecticAPI.streamDialectic(
            settings,
            (event: DialecticStreamEvent) => {
                switch (event.type) {
                    case 'session':
                        if (event.session_id) setSessionId(event.session_id)
                        break
                    case 'round_start':
                        if (event.round) setCurrentRound(event.round)
                        break
                    case 'thesis':
                    case 'antithesis':
                    case 'synthesis':
                        if (event.round && event.content) {
                            const roleMap = {
                                thesis: '正题',
                                antithesis: '反题',
                                synthesis: '合题',
                            } as const
                            addMessage({
                                round: event.round,
                                role: roleMap[event.type],
                                content: event.content,
                                thinking: event.thinking,
                            })
                            scrollToBottom()
                        }
                        break
                    case 'fallacy':
                        if (event.round) {
                            setFallacies(event.round, (event.items || []) as FallacyItem[])
                        }
                        break
                    case 'tree_update':
                        if (event.nodes && event.edges) {
                            setTree({ nodes: event.nodes, edges: event.edges } as DialecticTree)
                        }
                        break
                    case 'complete':
                        setLoading(false)
                        scrollToBottom()
                        break
                    case 'error':
                        setError(event.message || event.error || '未知错误')
                        setLoading(false)
                        break
                }
            },
            (err) => {
                setError(err.message)
                setLoading(false)
            }
        )
    }

    const roundsToRender = Array.from({ length: Math.max(currentRound, 1) }, (_, i) => i + 1)

    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
                <div className="text-center mb-8 sm:mb-12">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-500/10 text-emerald-600 text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in">
                        <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>黑格尔辩证法引擎</span>
                        <GitBranch className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight animate-slide-up delay-100 opacity-0">
                        <span className="text-gradient">观点进化</span>
                        <br />
                        <span className="text-foreground/80">正题·反题·合题</span>
                    </h1>

                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up delay-200 opacity-0 px-4 sm:px-0">
                        多轮辩证推进，实时生成合题与谬误标注，形成观点进化树。
                    </p>
                </div>

                <div className="max-w-4xl mx-auto space-y-10">
                    <div className="card-modern p-1 sm:p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-background/50 backdrop-blur-sm animate-scale-in delay-100 opacity-0">
                        <Input
                            placeholder="例如：技术进步是否必然带来社会公平？"
                            value={inputTopic}
                            onChange={(e) => setInputTopic(e.target.value)}
                            className="h-11 sm:h-12 border-0 bg-transparent focus-visible:ring-0 text-base sm:text-lg px-3 sm:px-4 shadow-none"
                            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleStart()}
                        />
                        <Button
                            onClick={handleStart}
                            disabled={isLoading || !inputTopic.trim()}
                            className="h-11 px-6 rounded-xl btn-primary shrink-0 w-full sm:w-auto transition-transform active:scale-95"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                        </Button>
                    </div>

                    <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground font-medium">轮次数</span>
                            <div className="flex items-center bg-muted/30 rounded-xl p-1 gap-1">
                                {[5, 7, 9].map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setRounds(n)}
                                        className={`
                                            relative px-4 py-2 rounded-lg transition-all duration-300 text-sm font-medium
                                            ${rounds === n
                                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                                                : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}
                                        `}
                                    >
                                        {n}轮
                                    </button>
                                ))}
                                <div className="flex items-center gap-1 px-2">
                                    <input
                                        type="number"
                                        min={1}
                                        max={15}
                                        value={rounds}
                                        onChange={(e) => {
                                            const v = Math.min(15, Math.max(1, Number(e.target.value) || 1))
                                            setRounds(v)
                                        }}
                                        className="w-12 h-8 text-center text-sm font-bold rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none"
                                    />
                                    <span className="text-xs text-muted-foreground">轮</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleThinking}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
                                    ${showThinking
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted/30 text-muted-foreground hover:text-foreground'}
                                `}
                            >
                                <Brain className="w-3 h-3" />
                                思考过程
                                {showThinking ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>

                            <button
                                onClick={toggleFallacies}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
                                    ${showFallacies
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted/30 text-muted-foreground hover:text-foreground'}
                                `}
                            >
                                <AlertTriangle className="w-3 h-3" />
                                谬误标注
                                {showFallacies ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-destructive/5 text-destructive text-sm text-center animate-spring">
                            {error}
                        </div>
                    )}

                    <div className="space-y-8">
                        {roundsToRender.map((round) => {
                            const roundMessages = messages.filter(m => m.round === round)
                            const roundFallacies = fallaciesByRound[round] || []
                            if (roundMessages.length === 0 && round > currentRound) return null

                            return (
                                <DialecticRoundPanel
                                    key={round}
                                    round={round}
                                    messages={roundMessages}
                                    fallacies={roundFallacies}
                                    showThinking={showThinking}
                                    showFallacies={showFallacies}
                                />
                            )
                        })}
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">观点进化树</span>
                        </div>
                        <DialecticTreeView tree={tree} />
                    </div>

                    {isLoading && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground animate-fade-in">
                            <div className="relative">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <Brain className="absolute inset-0 h-8 w-8 text-primary/30 animate-pulse" />
                            </div>
                            <span className="text-sm">辩证法引擎正在启动...</span>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    )
}
