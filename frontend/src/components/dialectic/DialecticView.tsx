import { useCallback, useRef, useState } from 'react'
import { useDialecticStore } from '@/stores/dialecticStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStreamRun } from '@/hooks/useStreamRun'
import { useInitialTopic } from '@/hooks/useInitialTopic'
import { dialecticAPI } from '@/services/api'
import { DialecticRoundPanel } from './DialecticRoundPanel'
import { DialecticTreeView } from './DialecticTreeView'
import type { DialecticStreamEvent } from '@/types'
import { Square } from 'lucide-react'

const ROUND_OPTIONS = [3, 5, 7]

export function DialecticView() {
    const initialTopic = useInitialTopic()
    const [inputTopic, setInputTopic] = useState(initialTopic)
    const [rounds, setRounds] = useState(5)
    const endRef = useRef<HTMLDivElement>(null)
    const run = useStreamRun()

    const {
        topic, messages, fallaciesByRound, tree, currentRound, isLoading, error,
        showThinking, showFallacies, beginRun, applyEvent, endRun, toggleThinking, toggleFallacies,
    } = useDialecticStore()
    const { defaultProvider, defaultModel } = useSettingsStore()

    const scrollToEnd = useCallback(() => {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)
    }, [])

    const handleStart = () => {
        const next = inputTopic.trim()
        if (!next || isLoading) return
        beginRun(next, rounds)
        const settings = { topic: next, rounds, provider: defaultProvider, model: defaultModel }
        void run.start<DialecticStreamEvent>(
            (onEvent, onError, signal) => dialecticAPI.streamDialectic(settings, onEvent, onError, signal),
            {
                onEvent: (event) => {
                    applyEvent(event)
                    scrollToEnd()
                },
                onFinish: (outcome, message) => endRun(outcome === 'failed' || outcome === 'truncated' ? message : null),
            },
        )
    }

    const roundsToRender = Array.from({ length: Math.max(currentRound, 1) }, (_, i) => i + 1)

    return (
        <div className="space-y-10">
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (isLoading) run.cancel(); else handleStart() }}>
                <div>
                    <label htmlFor="dialectic-topic" className="block text-sm text-ink-3 mb-2">起点观点</label>
                    <div className="field flex items-center gap-2 pl-4 pr-1.5 py-1.5">
                        <input
                            id="dialectic-topic"
                            placeholder="例如：技术进步必然带来社会公平"
                            value={inputTopic}
                            onChange={(e) => setInputTopic(e.target.value)}
                            className="flex-1 min-w-0 h-10 text-[1.0625rem] placeholder:text-ink-3"
                            autoComplete="off"
                        />
                        <button type="submit" disabled={!isLoading && !inputTopic.trim()} className="btn-ink shrink-0">
                            {isLoading ? <><Square className="h-3.5 w-3.5" fill="currentColor" />停止</> : '开始推演'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-ink-3">轮数</span>
                        <div className="segmented" role="group" aria-label="轮数">
                            {ROUND_OPTIONS.map((n) => (
                                <button key={n} type="button" aria-pressed={rounds === n} onClick={() => setRounds(n)}>{n}</button>
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
                        <button type="button" className="chip" aria-pressed={showThinking} onClick={toggleThinking}>思路</button>
                        <button type="button" className="chip" aria-pressed={showFallacies} onClick={toggleFallacies}>谬误标注</button>
                    </div>
                </div>
            </form>

            {error && (
                <div className="border-l-2 border-destructive bg-surface px-4 py-3 text-sm" role="alert">{error}</div>
            )}

            {isLoading && messages.length === 0 && <p className="text-sm text-ink-3" role="status">正在提出第一个正题…</p>}

            {topic && (
                <section aria-label="推演过程">
                    <h2 className="display text-[1.5rem] sm:text-[1.875rem] text-center max-w-[32rem] mx-auto mb-10">{topic}</h2>
                    <div className="relative">
                        <div className="absolute top-0 bottom-0 left-3 md:left-1/2 w-px bg-line-strong md:-translate-x-1/2" aria-hidden="true" />
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
                </section>
            )}

            {topic && (
                <section aria-labelledby="tree-title" className="space-y-3">
                    <h2 id="tree-title" className="text-xl">观点进化树</h2>
                    <DialecticTreeView tree={tree} />
                </section>
            )}

            <div ref={endRef} />
        </div>
    )
}
