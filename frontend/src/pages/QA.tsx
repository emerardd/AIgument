import { QAView } from '@/components/qa/QAView'
import { HelpCircle, BookOpen, Zap, Brain } from 'lucide-react'

export default function QA() {
    return (
        <div className="min-h-screen gradient-bg">
            {/* Hero Section */}
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
                <div className="text-center mb-8 sm:mb-12">
                    {/* Decorative Badge */}
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in">
                        <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>智能问答</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight animate-slide-up delay-100 opacity-0">
                        <span className="text-gradient">AI 问答</span>
                        <br />
                        <span className="text-foreground/80">专家</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up delay-200 opacity-0 px-4 sm:px-0">
                        选择回答风格，让 AI 以不同方式为你解答问题
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6 sm:mt-8 animate-slide-up delay-300 opacity-0">
                        {[
                            { icon: BookOpen, label: '全面分析' },
                            { icon: Zap, label: '简洁高效' },
                            { icon: Brain, label: '苏格拉底式' },
                        ].map(({ icon: Icon, label }) => (
                            <div
                                key={label}
                                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl glass shadow-soft-sm text-xs sm:text-sm text-muted-foreground hover:scale-105 transition-transform duration-300"
                            >
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* QA View */}
                <div className="animate-elastic delay-500 opacity-0">
                    <QAView />
                </div>
            </div>
        </div>
    )
}

