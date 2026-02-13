import { useState, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { debateAPI } from '@/services/api'
import type { DebateSettings, AgentStreamEvent, AgentThinking, RoundEvaluation } from '@/types'
import { CopyButton } from '@/components/ui/CopyButton'
import { ThinkingBubble } from './ThinkingBubble'
import { EvaluationPanel, StandingsPanel, VerdictPanel } from './ScorePanel'
import { ArgumentGraphView } from './ArgumentGraphView'
import {
    Loader2, ThumbsUp, ThumbsDown, ArrowRight,
    Brain, Eye, EyeOff, Sparkles, Settings2
} from 'lucide-react'

export function AgentDebateView() {
    const [inputTopic, setInputTopic] = useState('')
    const [rounds, setRounds] = useState(3)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const {
        messages,
        isLoading,
        error,
        thinkings,
        evaluations,
        standings,
        verdict,
        sessionId,
        currentRound,
        showThinking,
        showScores,
        addMessage,
        updateMessage,
        addThinking,
        addEvaluation,
        setStandings,
        setVerdict,
        setSessionId,
        setCurrentRound,
        setTotalRounds,
        setLoading,
        setError,
        setTopic,
        toggleShowThinking,
        toggleShowScores,
        clear,
    } = useAgentDebateStore()

    const { defaultProvider, defaultModel } = useSettingsStore()

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
    }, [])

    const handleStart = async () => {
        if (!inputTopic.trim()) return

        clear()
        setLoading(true)
        setError(null)
        setTopic(inputTopic)
        setTotalRounds(rounds)
        scrollToBottom()

        const settings: DebateSettings = {
            topic: inputTopic,
            rounds,
            provider: defaultProvider,
            model: defaultModel,
            stream: true,
        }

        // 消息索引映射
        const messageMap = new Map<string, number>()

        debateAPI.streamAgentDebate(
            settings,
            (event: AgentStreamEvent) => {
                switch (event.type) {
                    case 'session':
                        if (event.session_id) {
                            setSessionId(event.session_id)
                        }
                        break

                    case 'opening':
                        // 可以显示开场信息
                        break

                    case 'round_start':
                        if (event.round) {
                            setCurrentRound(event.round)
                        }
                        break

                    case 'thinking':
                        if (event.side && event.content && typeof event.content === 'object') {
                            const thinking: AgentThinking = {
                                side: event.side,
                                name: event.name || (event.side === 'pro' ? '正方' : '反方'),
                                content: event.content as AgentThinking['content'],
                                confidence: event.confidence || 0.5,
                                round: event.round || currentRound,
                            }
                            addThinking(thinking)
                            scrollToBottom()
                        }
                        break

                    case 'argument':
                        if (event.side && event.content && typeof event.content === 'string') {
                            const key = `${event.round}-${event.side}`
                            const msgIndex = messageMap.get(key)
                            const role = event.side === 'pro' ? '正方' : '反方'

                            if (msgIndex === undefined) {
                                const currentLength = useAgentDebateStore.getState().messages.length
                                messageMap.set(key, currentLength)

                                // 找到对应的思考过程
                                const relatedThinking = useAgentDebateStore.getState().thinkings.find(
                                    t => t.round === event.round && t.side === event.side
                                )

                                addMessage({
                                    role: role as '正方' | '反方',
                                    content: event.content,
                                    round: event.round,
                                    thinking: relatedThinking?.content,
                                    confidence: relatedThinking?.confidence,
                                })
                            } else {
                                updateMessage(msgIndex, event.content)
                            }
                            scrollToBottom()
                        }
                        break

                    case 'evaluation': {
                        const evaluation: RoundEvaluation = {
                            round: event.round || currentRound,
                            pro_score: event.pro_score || { logic: 5, evidence: 5, rhetoric: 5, rebuttal: 5 },
                            con_score: event.con_score || { logic: 5, evidence: 5, rhetoric: 5, rebuttal: 5 },
                            round_winner: event.round_winner || 'tie',
                            commentary: event.commentary || '',
                            highlights: event.highlights || [],
                            suggestions: event.suggestions || {},
                        }
                        addEvaluation(evaluation)
                        scrollToBottom()
                        break
                    }

                    case 'standings':
                        if (event.standings) {
                            setStandings(event.standings)
                        }
                        break

                    case 'verdict':
                        setVerdict({
                            winner: event.winner || 'tie',
                            pro_total_score: event.pro_total_score || 0,
                            con_total_score: event.con_total_score || 0,
                            margin: (event.margin as 'decisive' | 'close' | 'marginal') || 'close',
                            summary: event.summary || '',
                            pro_strengths: event.pro_strengths || [],
                            con_strengths: event.con_strengths || [],
                            key_turning_points: event.key_turning_points || [],
                        })
                        scrollToBottom()
                        break

                    case 'complete':
                        setLoading(false)
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

    // 按轮次组织消息
    const getMessagesForRound = (round: number) => {
        return messages.filter(msg => msg.round === round)
    }

    const getEvaluationForRound = (round: number) => {
        return evaluations.find(e => e.round === round)
    }

    const getThinkingsForRound = (round: number) => {
        return thinkings.filter(t => t.round === round)
    }

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            {/* 标题区域 */}
            <div className="space-y-6">
                <div className="text-center space-y-2 animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                        <Sparkles className="w-4 h-4" />
                        Multi-Agent 模式
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">智能辩论</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        AI 代理将进行深度思考、策略推理，并由专业评审打分
                    </p>
                </div>

                {/* 输入区域 */}
                <div className="card-modern p-1 sm:p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-background/50 backdrop-blur-sm animate-scale-in delay-100 opacity-0">
                    <Input
                        placeholder="例如：人工智能是否会取代人类工作？"
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
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <ArrowRight className="h-5 w-5" />
                        )}
                    </Button>
                </div>

                {/* 设置面板 */}
                <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 animate-fade-in delay-200 opacity-0">
                    {/* 轮次选择 */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground font-medium">辩论轮次</span>
                        <div className="flex bg-muted/30 rounded-xl p-1 gap-1">
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
                        </div>
                    </div>

                    {/* 显示选项 */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleShowThinking}
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
                            onClick={toggleShowScores}
                            className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
                                ${showScores
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'}
                            `}
                        >
                            <Settings2 className="w-3 h-3" />
                            评分面板
                            {showScores ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                    </div>

                    {/* 模型信息 */}
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

            {/* 错误提示 */}
            {error && (
                <div className="p-4 rounded-xl bg-destructive/5 text-destructive text-sm text-center animate-spring">
                    {error}
                </div>
            )}

            {/* 辩论内容 - 按轮次组织 */}
            <div className="space-y-8">
                {Array.from({ length: Math.max(currentRound, 1) }, (_, i) => i + 1).map((round) => {
                    const roundMessages = getMessagesForRound(round)
                    const roundEvaluation = getEvaluationForRound(round)
                    const roundThinkings = getThinkingsForRound(round)

                    if (roundMessages.length === 0 && round > currentRound) return null

                    return (
                        <div key={round} className="space-y-4">
                            {/* 轮次标题 */}
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-sm font-medium text-muted-foreground px-3 py-1 rounded-full bg-muted/30">
                                    第 {round} 轮
                                </span>
                                <div className="h-px flex-1 bg-border" />
                            </div>

                            {/* 思考过程 */}
                            {showThinking && roundThinkings.length > 0 && (
                                <div className="space-y-2">
                                    {roundThinkings.map((thinking, idx) => (
                                        <ThinkingBubble key={idx} thinking={thinking} />
                                    ))}
                                </div>
                            )}

                            {/* 论点消息 */}
                            {roundMessages.map((msg, idx) => {
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

                                        {/* Message */}
                                        <div className={`
                                            max-w-[90%] sm:max-w-[85%] space-y-2
                                            ${isPro ? 'items-start' : 'items-end flex flex-col'}
                                        `}>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground">
                                                    {isPro ? '正方' : '反方'}
                                                </span>
                                                {msg.confidence !== undefined && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="text-primary">
                                                            置信度 {Math.round(msg.confidence * 100)}%
                                                        </span>
                                                    </>
                                                )}
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
                                                        <span>正在发言...</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {/* 评审评分 */}
                            {showScores && roundEvaluation && (
                                <EvaluationPanel evaluation={roundEvaluation} />
                            )}
                        </div>
                    )
                })}

                {/* 最终裁决 */}
                {verdict && (
                    <VerdictPanel
                        winner={verdict.winner}
                        proScore={verdict.pro_total_score}
                        conScore={verdict.con_total_score}
                        margin={verdict.margin}
                        summary={verdict.summary}
                        proStrengths={verdict.pro_strengths}
                        conStrengths={verdict.con_strengths}
                        keyTurningPoints={verdict.key_turning_points}
                    />
                )}

                {/* 论点图谱分析 - 辩论完成后显示 */}
                {verdict && sessionId && (
                    <div className="mt-8 animate-fade-in">
                        <ArgumentGraphView sessionId={sessionId} />
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* 加载指示器 */}
            {isLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground animate-fade-in">
                    <div className="relative">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <Brain className="absolute inset-0 h-8 w-8 text-primary/30 animate-pulse" />
                    </div>
                    <span className="text-sm">AI 代理正在准备辩论...</span>
                </div>
            )}

            {/* 实时比分面板 */}
            {showScores && standings && isLoading && (
                <StandingsPanel standings={standings} />
            )}
        </div>
    )
}
