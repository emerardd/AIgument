import { useCallback, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDialecticStore } from '@/stores/dialecticStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStreamRun } from '@/hooks/useStreamRun'
import { dialecticAPI } from '@/services/api'
import { DialecticRoundPanel } from './DialecticRoundPanel'
import { DialecticTreeView } from './DialecticTreeView'
import type { DialecticStreamEvent } from '@/types'
import { AlertTriangle, ArrowRight, Brain, Eye, EyeOff, GitBranch, Loader2, Square } from 'lucide-react'

export function DialecticView() {
    const [inputTopic, setInputTopic] = useState('')
    const [rounds, setRounds] = useState(5)
    const bottomRef = useRef<HTMLDivElement>(null)
    const run = useStreamRun()

    const {
        messages, fallaciesByRound, tree, currentRound, isLoading, error,
        showThinking, showFallacies, beginRun, applyEvent, endRun, toggleThinking, toggleFallacies,
    } = useDialecticStore()
    const { defaultProvider, defaultModel } = useSettingsStore()

    const scrollToBottom = useCallback(() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }, [])

    const handleStart = () => {
        const topic = inputTopic.trim()
        if (!topic || isLoading) return
        beginRun(topic, rounds)
        scrollToBottom()
        const settings = { topic, rounds, provider: defaultProvider, model: defaultModel }
        void run.start<DialecticStreamEvent>(
            (onEvent, onError, signal) => dialecticAPI.streamDialectic(settings, onEvent, onError, signal),
            {
                onEvent: (event) => {
                    applyEvent(event)
                    scrollToBottom()
                },
                onFinish: (outcome, message) => endRun(outcome === 'failed' || outcome === 'truncated' ? message : null),
            },
        )
    }

    const roundsToRender = Array.from({ length: Math.max(currentRound, 1) }, (_, i) => i + 1)

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            <div className="card-modern p-1 sm:p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-background/50 backdrop-blur-sm">
                <Input
                    placeholder="例如：技术进步是否必然带来社会公平？"
                    value={inputTopic}
                    onChange={(e) => setInputTopic(e.target.value)}
                    className="h-11 sm:h-12 border-0 bg-transparent focus-visible:ring-0 text-base sm:text-lg px-3 sm:px-4 shadow-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                />
                <Button
                    onClick={isLoading ? run.cancel : handleStart}
                    disabled={!isLoading && !inputTopic.trim()}
                    className="h-11 px-6 rounded-xl btn-primary shrink-0 w-full sm:w-auto transition-transform active:scale-95"
                    title={isLoading ? '停止生成' : '启动辩证法引擎'}
                >
                    {isLoading ? <Square className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
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
                                className={`relative px-4 py-2 rounded-lg transition-all duration-300 text-sm font-medium ${rounds === n
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
                            >
                                {n}轮
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
                    {[
                        { active: showThinking, onClick: toggleThinking, icon: Brain, label: '思考过程' },
                        { active: showFallacies, onClick: toggleFallacies, icon: AlertTriangle, label: '谬误标注' },
                    ].map(({ active, onClick, icon: Icon, label }) => (
                        <button
                            key={label}
                            onClick={onClick}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${active
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted/30 text-muted-foreground hover:text-foreground'}`}
                        >
                            <Icon className="w-3 h-3" />
                            {label}
                            {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-destructive/5 text-destructive text-sm text-center animate-spring" role="alert">
                    {error}
                </div>
            )}

            <div className="space-y-8">
                {roundsToRender.map((round) => {
                    const roundMessages = messages.filter(m => m.round === round)
                    if (roundMessages.length === 0 && round > currentRound) return null
                    return (
                        <DialecticRoundPanel
                            key={round}
                            round={round}
                            messages={roundMessages}
                            fallacies={fallaciesByRound[round] || []}
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
    )
}
