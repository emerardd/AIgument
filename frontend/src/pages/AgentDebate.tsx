import { AgentDebateView } from '@/components/debate/AgentDebateView'
import { Sparkles, Brain, Award, Target, MessageSquare } from 'lucide-react'

export default function AgentDebate() {
    return (
        <div className="min-h-screen gradient-bg">
            {/* Hero Section */}
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
                <div className="text-center mb-8 sm:mb-12">
                    {/* Decorative Badge */}
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in border border-primary/20">
                        <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Multi-Agent 智能辩论</span>
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight animate-slide-up delay-100 opacity-0">
                        <span className="text-gradient">AI 代理</span>
                        <br />
                        <span className="text-foreground/80">深度辩论</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up delay-200 opacity-0 px-4 sm:px-0">
                        多个 AI 代理协同工作：独立思考、策略推理、专业评审，呈现更深度的辩论体验
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6 sm:mt-8 animate-slide-up delay-300 opacity-0">
                        {[
                            { icon: Brain, label: 'ReAct 推理', desc: '思考可见' },
                            { icon: Target, label: '策略选择', desc: '6种策略' },
                            { icon: Award, label: '专业评审', desc: '4维评分' },
                            { icon: MessageSquare, label: '最终裁决', desc: '胜负判定' },
                        ].map(({ icon: Icon, label, desc }) => (
                            <div
                                key={label}
                                className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl glass shadow-soft-sm text-xs sm:text-sm hover:scale-105 transition-transform duration-300 min-w-[80px]"
                            >
                                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                <span className="font-medium text-foreground">{label}</span>
                                <span className="text-muted-foreground text-[10px]">{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Agent Debate View */}
                <div className="animate-elastic delay-500 opacity-0">
                    <AgentDebateView />
                </div>
            </div>
        </div>
    )
}
