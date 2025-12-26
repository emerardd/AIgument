import { useState } from 'react'
import { HistoryList } from '@/components/history/HistoryList'
import { SessionDetailModal } from '@/components/history/SessionDetailModal'
import { History as HistoryIcon, Clock, Archive } from 'lucide-react'

export default function History() {
    const [selectedId, setSelectedId] = useState<number | null>(null)

    return (
        <div className="min-h-screen gradient-bg">
            {/* Hero Section */}
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
                <div className="text-center mb-8 sm:mb-12">
                    {/* Decorative Badge */}
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in">
                        <HistoryIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>历史记录</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight animate-slide-up delay-100 opacity-0">
                        <span className="text-gradient">辩论历史</span>
                        <br />
                        <span className="text-foreground/80">记录</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up delay-200 opacity-0 px-4 sm:px-0">
                        查看和管理您的辩论、对话记录，回顾精彩的思维碰撞
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6 sm:mt-8 animate-slide-up delay-300 opacity-0">
                        {[
                            { icon: Archive, label: '完整存档' },
                            { icon: Clock, label: '时间线' },
                            { icon: HistoryIcon, label: '随时回顾' },
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

                {/* History List */}
                <div className="max-w-4xl mx-auto animate-elastic delay-500 opacity-0">
                    <HistoryList onViewDetail={(id) => setSelectedId(id)} />
                </div>

                {/* 详情模态框 */}
                <SessionDetailModal
                    sessionId={selectedId || 0}
                    isOpen={selectedId !== null}
                    onClose={() => setSelectedId(null)}
                />
            </div>
        </div>
    )
}
