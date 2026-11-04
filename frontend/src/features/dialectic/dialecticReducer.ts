import type { DialecticStreamEvent, DialecticTree, FallacyItem } from '@/types'

export interface DialecticMessage {
    round: number
    role: '正题' | '反题' | '合题'
    content: string
    thinking?: Record<string, unknown>
}

export interface DialecticRunState {
    sessionId: number | null
    currentRound: number
    messages: DialecticMessage[]
    fallaciesByRound: Record<number, FallacyItem[]>
    tree: DialecticTree | null
}

export const initialDialecticRun: DialecticRunState = {
    sessionId: null,
    currentRound: 0,
    messages: [],
    fallaciesByRound: {},
    tree: null,
}

const ROLES = { thesis: '正题', antithesis: '反题', synthesis: '合题' } as const

/** Apply one stream event. Pure: returns the same object when nothing changes. */
export function reduceDialecticEvent(state: DialecticRunState, event: DialecticStreamEvent): DialecticRunState {
    switch (event.type) {
        case 'session':
            return event.session_id ? { ...state, sessionId: event.session_id } : state

        case 'round_start':
            return event.round ? { ...state, currentRound: event.round } : state

        case 'thesis':
        case 'antithesis':
        case 'synthesis': {
            if (!event.round || !event.content) return state
            const role = ROLES[event.type]
            const message: DialecticMessage = { round: event.round, role, content: event.content, thinking: event.thinking }
            const others = state.messages.filter(m => !(m.round === event.round && m.role === role))
            return { ...state, messages: [...others, message] }
        }

        case 'fallacy':
            return event.round
                ? { ...state, fallaciesByRound: { ...state.fallaciesByRound, [event.round]: event.items || [] } }
                : state

        case 'tree_update':
            return event.nodes && event.edges ? { ...state, tree: { nodes: event.nodes, edges: event.edges } } : state

        case 'complete':
            return event.tree ? { ...state, tree: event.tree } : state

        default:
            return state
    }
}
