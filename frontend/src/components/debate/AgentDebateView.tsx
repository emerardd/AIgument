import { useCallback, useRef } from 'react'
import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { useAgentDebateRun } from '@/features/debate/useAgentDebateRun'
import { AgentDebateForm } from './AgentDebateForm'
import { AgentDebateTranscript } from './AgentDebateTranscript'
import { AgentDebateResults } from './AgentDebateResults'

export function AgentDebateView() {
    const endRef = useRef<HTMLDivElement>(null)
    const { isLoading, error, messages } = useAgentDebateStore()

    const scrollToEnd = useCallback(() => {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)
    }, [])
    const { start, cancel } = useAgentDebateRun(scrollToEnd)

    return (
        <div className="space-y-10">
            <AgentDebateForm isLoading={isLoading} onStart={start} onCancel={cancel} />

            {error && (
                <div className="border-l-2 border-destructive bg-surface px-4 py-3 text-sm text-ink" role="alert">
                    {error}
                </div>
            )}

            {isLoading && messages.length === 0 && (
                <p className="text-sm text-ink-3" role="status">双方正在审题…</p>
            )}

            <AgentDebateTranscript />
            <AgentDebateResults />
            <div ref={endRef} />
        </div>
    )
}
