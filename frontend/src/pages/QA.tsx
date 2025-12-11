import { QAView } from '@/components/qa/QAView'
import { HelpCircle } from 'lucide-react'

export default function QA() {
    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
                {/* Header */}
                <div className="text-center mb-6 sm:mb-10 animate-fade-in">
                    <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs sm:text-sm font-medium mb-3 sm:mb-4">
                        <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>智能问答</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">
                        <span className="text-gradient-purple">AI 问答专家</span>
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto px-4 sm:px-0">
                        选择回答风格，让 AI 以不同方式为你解答问题
                    </p>
                </div>

                <QAView />
            </div>
        </div>
    )
}

