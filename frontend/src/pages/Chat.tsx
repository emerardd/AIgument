import { ChatView } from '@/components/chat/ChatView'
import { MessageCircle } from 'lucide-react'

export default function Chat() {
    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
                {/* Header */}
                <div className="text-center mb-6 sm:mb-10 animate-fade-in">
                    <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-medium mb-3 sm:mb-4">
                        <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>智能对话</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">
                        <span className="text-gradient-blue">AI 对话助手</span>
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto px-4 sm:px-0">
                        与 AI 进行流畅的对话，获取信息、解答疑问、激发灵感
                    </p>
                </div>

                <ChatView />
            </div>
        </div>
    )
}

