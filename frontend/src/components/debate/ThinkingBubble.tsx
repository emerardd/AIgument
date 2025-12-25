import type { AgentThinking } from '@/types'
import { Brain, Lightbulb, Target, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface ThinkingBubbleProps {
    thinking: AgentThinking
    expanded?: boolean
}

export function ThinkingBubble({ thinking, expanded: initialExpanded = false }: ThinkingBubbleProps) {
    const [expanded, setExpanded] = useState(initialExpanded)
    const isPro = thinking.side === 'pro'

    const content = thinking.content
    const hasContent = content && Object.keys(content).length > 0

    if (!hasContent) return null

    const bgColor = isPro ? 'bg-blue-500/5 border-blue-500/20' : 'bg-orange-500/5 border-orange-500/20'
    const iconColor = isPro ? 'text-blue-500' : 'text-orange-500'

    // 获取策略显示名称
    const getStrategyName = (strategy: string) => {
        const strategies: Record<string, string> = {
            'direct_refute': '直接反驳',
            'evidence_attack': '证据攻击',
            'reframe': '重新定义',
            'counter_example': '反例论证',
            'consequence': '后果推演',
            'strengthen': '强化己方',
        }
        return strategies[strategy] || strategy
    }

    return (
        <div className={`
            rounded-xl border ${bgColor} overflow-hidden
            transition-all duration-300 animate-fade-in
        `}>
            {/* Header - 始终显示 */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 p-3 hover:bg-muted/30 transition-colors"
            >
                <Brain className={`w-4 h-4 ${iconColor}`} />
                <span className="text-xs font-medium text-muted-foreground">
                    {thinking.name} 思考中...
                </span>

                {/* 置信度 */}
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>置信度</span>
                        <span className="font-medium">{Math.round(thinking.confidence * 100)}%</span>
                    </div>
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            </button>

            {/* 展开的详情 */}
            {expanded && (
                <div className="px-3 pb-3 space-y-3 animate-slide-up">
                    {/* 策略选择 */}
                    {content.selected_strategy && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                            <Target className="w-4 h-4 text-primary" />
                            <span className="text-xs text-muted-foreground">策略:</span>
                            <span className="text-xs font-medium">
                                {getStrategyName(content.selected_strategy)}
                            </span>
                        </div>
                    )}

                    {/* 开场分析 */}
                    {content.topic_analysis && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                <Lightbulb className="w-3 h-3" />
                                辩题分析
                            </div>
                            <p className="text-xs text-muted-foreground pl-4">{content.topic_analysis}</p>
                        </div>
                    )}

                    {/* 核心立场 */}
                    {content.core_stance && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                <Shield className="w-3 h-3" />
                                核心立场
                            </div>
                            <p className="text-xs text-muted-foreground pl-4">{content.core_stance}</p>
                        </div>
                    )}

                    {/* 对手弱点 */}
                    {content.opponent_weaknesses && content.opponent_weaknesses.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">发现的弱点</div>
                            <ul className="pl-4 space-y-0.5">
                                {content.opponent_weaknesses.map((weakness, i) => (
                                    <li key={i} className="text-xs text-red-500/80">• {weakness}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 反驳要点 */}
                    {content.counter_points && content.counter_points.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">反驳要点</div>
                            <ul className="pl-4 space-y-0.5">
                                {content.counter_points.map((point, i) => (
                                    <li key={i} className="text-xs text-muted-foreground">• {point}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 新论点 */}
                    {content.new_arguments && content.new_arguments.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">新论点</div>
                            <ul className="pl-4 space-y-0.5">
                                {content.new_arguments.map((arg, i) => (
                                    <li key={i} className="text-xs text-green-500/80">• {arg}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 核心论点（开场） */}
                    {content.key_arguments && content.key_arguments.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">核心论点</div>
                            <ul className="pl-4 space-y-0.5">
                                {content.key_arguments.map((arg, i) => (
                                    <li key={i} className="text-xs text-muted-foreground">• {arg}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 策略原因 */}
                    {content.strategy_reason && (
                        <div className="p-2 rounded-lg bg-muted/20 text-xs text-muted-foreground italic">
                            "{content.strategy_reason}"
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

interface ThinkingListProps {
    thinkings: AgentThinking[]
    currentRound: number
}

export function ThinkingList({ thinkings, currentRound }: ThinkingListProps) {
    const roundThinkings = thinkings.filter(t => t.round === currentRound)

    if (roundThinkings.length === 0) return null

    return (
        <div className="space-y-2 mb-4">
            {roundThinkings.map((thinking, idx) => (
                <ThinkingBubble key={idx} thinking={thinking} />
            ))}
        </div>
    )
}
