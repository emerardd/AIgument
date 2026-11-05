import { useCallback, useRef, useState } from 'react'
import { useDialecticStore } from '@/stores/dialecticStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStreamRun } from '@/hooks/useStreamRun'
import { useInitialTopic } from '@/hooks/useInitialTopic'
import { dialecticAPI } from '@/services/api'
import { TurnRail, type RailRound, type TurnState } from '@/components/session/TurnRail'
import { SessionLayout, SideActions } from '@/components/session/SessionLayout'
import { DialecticRoundPanel } from './DialecticRoundPanel'
import { dialecticTurnId } from '@/features/dialectic/turnIds'
import { DialecticTreeView } from './DialecticTreeView'
import type { DialecticStreamEvent } from '@/types'
import { RotateCcw, Square } from 'lucide-react'

const ROUND_OPTIONS = [3, 5, 7]
type Kind = 'thesis' | 'antithesis' | 'synthesis'

function useDialecticRail(): { rail: RailRound[]; states: Record<number, Record<Kind, TurnState>> } {
    const { messages, rounds, currentRound, isLoading } = useDialecticStore()
    const states: Record<number, Record<Kind, TurnState>> = {}

    const rail = Array.from({ length: Math.max(rounds, currentRound) }, (_, i) => {
        const round = i + 1
        const has = (role: string) => messages.some(m => m.round === round && m.role === role)
        const thesis = has('正题'), antithesis = has('反题'), synthesis = has('合题')
        const state = (done: boolean, begun: boolean): TurnState => (done ? 'done' : begun && isLoading ? 'live' : 'pending')

        states[round] = {
            thesis: state(thesis, currentRound >= round),
            antithesis: state(antithesis, thesis),
            synthesis: state(synthesis, antithesis),
        }
        return {
            round,
            turns: [
                { target: dialecticTurnId(round, 'thesis'), voice: 'a' as const, label: '正题', state: states[round].thesis },
                { target: dialecticTurnId(round, 'antithesis'), voice: 'b' as const, label: '反题', state: states[round].antithesis },
                { target: dialecticTurnId(round, 'synthesis'), voice: 'judge' as const, label: '合题', state: states[round].synthesis },
            ],
        }
    })
    return { rail, states }
}

export function DialecticView() {
    const initialTopic = useInitialTopic()
    const [inputTopic, setInputTopic] = useState(initialTopic)
    const [rounds, setRounds] = useState(5)
    const endRef = useRef<HTMLDivElement>(null)
    const run = useStreamRun()

    const {
        topic, rounds: totalRounds, messages, fallaciesByRound, tree, currentRound, isLoading, error,
        showThinking, showFallacies, beginRun, applyEvent, endRun, reset, toggleThinking, toggleFallacies,
    } = useDialecticStore()
    const { defaultProvider, defaultModel } = useSettingsStore()
    const { rail, states } = useDialecticRail()

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

    if (!topic) {
        return (
            <form
                className="panel px-5 sm:px-8 py-6 sm:py-8 max-w-[760px] space-y-5"
                onSubmit={(e) => { e.preventDefault(); handleStart() }}
            >
                <div>
                    <label htmlFor="dialectic-topic" className="block t-small text-ink-2 mb-2">起点观点</label>
                    <div className="field flex items-center gap-2 pl-4 pr-1.5 py-1.5">
                        <input
                            id="dialectic-topic"
                            placeholder="技术进步必然带来社会公平"
                            value={inputTopic}
                            onChange={(e) => setInputTopic(e.target.value)}
                            className="flex-1 min-w-0 h-10 text-[1.0625rem] placeholder:text-ink-3"
                            autoComplete="off"
                        />
                        <button type="submit" disabled={!inputTopic.trim()} className="btn-ink shrink-0">开始推演</button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="flex items-center gap-3">
                        <span className="t-small text-ink-2">轮数</span>
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
                            className="field w-14 h-8 text-center t-small tabular-nums"
                            aria-label="自定义轮数"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="chip" aria-pressed={showThinking} onClick={toggleThinking}>思路</button>
                        <button type="button" className="chip" aria-pressed={showFallacies} onClick={toggleFallacies}>谬误标注</button>
                    </div>
                </div>
            </form>
        )
    }

    const roundsToRender = rail.filter(r => r.round <= Math.max(currentRound, 1))

    return (
        <SessionLayout
            kicker={`${totalRounds} 轮辩证推演`}
            topic={topic}
            rail={<TurnRail rounds={rail} label="推演进度" />}
            error={error}
            side={
                <>
                    <div className="panel px-5 py-5">
                        <p className="t-meta">进度</p>
                        <p className="mt-1 flex items-baseline gap-1">
                            <span className="numeral text-[2.5rem] leading-none">{Math.min(currentRound, totalRounds)}</span>
                            <span className="t-small text-ink-3">/ {totalRounds} 轮</span>
                        </p>
                        <p className="t-small text-ink-2 mt-3">每一轮的合题会成为下一轮的正题。</p>
                    </div>
                    <div className="panel px-5 py-4 flex flex-wrap gap-2">
                        <button type="button" className="chip" aria-pressed={showThinking} onClick={toggleThinking}>思路</button>
                        <button type="button" className="chip" aria-pressed={showFallacies} onClick={toggleFallacies}>谬误标注</button>
                    </div>
                    <SideActions>
                        {isLoading ? (
                            <button type="button" onClick={run.cancel} className="btn-ink w-full">
                                <Square className="h-3.5 w-3.5" fill="currentColor" />停止推演
                            </button>
                        ) : (
                            <button type="button" onClick={reset} className="btn-ink w-full">
                                <RotateCcw className="h-4 w-4" />换个观点
                            </button>
                        )}
                    </SideActions>
                </>
            }
        >
            {isLoading && messages.length === 0 && <p className="text-ink-3 streaming" role="status">正在提出第一个正题</p>}

            {roundsToRender.map(({ round }) => (
                <DialecticRoundPanel
                    key={round}
                    round={round}
                    messages={messages.filter(m => m.round === round)}
                    fallacies={fallaciesByRound[round] || []}
                    states={states[round]}
                    showThinking={showThinking}
                    showFallacies={showFallacies}
                />
            ))}

            {tree && tree.nodes.length > 0 && (
                <section aria-labelledby="tree-title" className="space-y-3">
                    <h2 id="tree-title" className="text-[1.25rem]">观点进化树</h2>
                    <DialecticTreeView tree={tree} />
                </section>
            )}

            <div ref={endRef} />
        </SessionLayout>
    )
}
