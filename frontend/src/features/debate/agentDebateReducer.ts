import type {
    AgentStreamEvent,
    AgentThinking,
    DebateMessage,
    DebateStandings,
    FinalVerdict,
    RoundEvaluation,
    RoundScore,
} from '@/types'

export interface AgentDebateMessage extends DebateMessage {
    thinking?: AgentThinking['content']
    confidence?: number
}

/** Everything a single debate run produces; reset at the start of each run. */
export interface AgentDebateRunState {
    sessionId: number | null
    currentRound: number
    messages: AgentDebateMessage[]
    thinkings: AgentThinking[]
    evaluations: RoundEvaluation[]
    standings: DebateStandings | null
    verdict: FinalVerdict | null
}

export const initialAgentDebateRun: AgentDebateRunState = {
    sessionId: null,
    currentRound: 0,
    messages: [],
    thinkings: [],
    evaluations: [],
    standings: null,
    verdict: null,
}

const NEUTRAL_SCORE: RoundScore = { logic: 5, evidence: 5, rhetoric: 5, rebuttal: 5 }

const roleOf = (side: 'pro' | 'con') => (side === 'pro' ? '正方' : '反方')

/** Apply one stream event. Pure: returns the same object when nothing changes. */
export function reduceAgentDebateEvent(state: AgentDebateRunState, event: AgentStreamEvent): AgentDebateRunState {
    const round = event.round || state.currentRound

    switch (event.type) {
        case 'session':
            return event.session_id ? { ...state, sessionId: event.session_id } : state

        case 'round_start':
            return event.round ? { ...state, currentRound: event.round } : state

        case 'thinking': {
            if (!event.side || !event.content || typeof event.content !== 'object') return state
            const thinking: AgentThinking = {
                side: event.side,
                name: event.name || roleOf(event.side),
                content: event.content as AgentThinking['content'],
                confidence: event.confidence ?? 0.5,
                round,
            }
            return { ...state, thinkings: [...state.thinkings, thinking] }
        }

        case 'argument':
        case 'argument_complete': {
            if (!event.side || typeof event.content !== 'string') return state
            const role = roleOf(event.side)
            const index = state.messages.findIndex(msg => msg.round === round && msg.role === role)
            if (index >= 0) {
                if (state.messages[index].content === event.content) return state
                const messages = state.messages.map((msg, i) => (i === index ? { ...msg, content: event.content as string } : msg))
                return { ...state, messages }
            }
            const thinking = state.thinkings.find(t => t.round === round && t.side === event.side)
            const message: AgentDebateMessage = {
                role,
                content: event.content,
                round,
                thinking: thinking?.content,
                confidence: thinking?.confidence,
            }
            return { ...state, messages: [...state.messages, message] }
        }

        case 'evaluation': {
            const evaluation: RoundEvaluation = {
                round,
                pro_score: event.pro_score || NEUTRAL_SCORE,
                con_score: event.con_score || NEUTRAL_SCORE,
                round_winner: event.round_winner || 'tie',
                commentary: event.commentary || '',
                highlights: event.highlights || [],
                suggestions: event.suggestions || {},
            }
            return { ...state, evaluations: [...state.evaluations.filter(e => e.round !== round), evaluation] }
        }

        case 'standings':
            return event.standings ? { ...state, standings: event.standings } : state

        case 'verdict':
            return {
                ...state,
                verdict: {
                    winner: event.winner || 'tie',
                    pro_total_score: event.pro_total_score || 0,
                    con_total_score: event.con_total_score || 0,
                    margin: (event.margin as FinalVerdict['margin']) || 'close',
                    summary: event.summary || '',
                    pro_strengths: event.pro_strengths || [],
                    con_strengths: event.con_strengths || [],
                    key_turning_points: event.key_turning_points || [],
                },
            }

        default:
            return state
    }
}
