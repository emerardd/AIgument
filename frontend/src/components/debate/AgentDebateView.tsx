import { useCallback, useRef } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { useAgentDebateRun } from '@/features/debate/useAgentDebateRun'
import { AgentDebateForm } from './AgentDebateForm'
import { AgentDebateTranscript } from './AgentDebateTranscript'
import { AgentDebateResults } from './AgentDebateResults'
import { StandingsPanel } from './ScorePanel'
import { Brain, Loader2 } from 'lucide-react'

export function AgentDebateView() {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { isLoading, error, messages, standings, showScores } = useAgentDebateStore()

    const scrollToBottom = useCallback(() => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }, [])
    const { start, cancel } = useAgentDebateRun(scrollToBottom)

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            <AgentDebateForm isLoading={isLoading} onStart={start} onCancel={cancel} />

            {error && (
                <div className="p-4 rounded-xl bg-destructive/5 text-destructive text-sm text-center animate-spring" role="alert">
                    {error}
                </div>
            )}

            <div className="space-y-8">
                <AgentDebateTranscript />
                <AgentDebateResults />
                <div ref={messagesEndRef} />
            </div>

            {isLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground animate-fade-in">
                    <div className="relative">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <Brain className="absolute inset-0 h-8 w-8 text-primary/30 animate-pulse" />
                    </div>
                    <span className="text-sm">AI 代理正在准备辩论...</span>
                </div>
            )}

            {showScores && standings && isLoading && <StandingsPanel standings={standings} />}
        </div>
    )
}
