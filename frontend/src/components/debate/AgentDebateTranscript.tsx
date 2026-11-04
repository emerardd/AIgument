import { useAgentDebateStore } from '@/stores/agentDebateStore'
import { TurnRail, type RailRound, type TurnState } from '@/components/session/TurnRail'
import { Utterance } from '@/components/session/Utterance'
import { ThinkingBubble } from './ThinkingBubble'
import { RoundRuling } from './ScorePanel'

const turnId = (round: number, who: 'pro' | 'con' | 'judge') => `r${round}-${who}`

/** Derive each turn's state from what the stream has produced so far. */
function useDebateRail(): RailRound[] {
    const { messages, thinkings, evaluations, totalRounds, isLoading, verdict } = useAgentDebateStore()
    const rounds = Math.max(totalRounds, ...messages.map(m => m.round ?? 0))

    return Array.from({ length: rounds }, (_, i) => {
        const round = i + 1
        const pro = messages.find(m => m.round === round && m.role === '正方')
        const con = messages.find(m => m.round === round && m.role === '反方')
        const ruled = evaluations.some(e => e.round === round)
        const started = (side: 'pro' | 'con') => thinkings.some(t => t.round === round && t.side === side)

        const state = (done: boolean, begun: boolean): TurnState =>
            done ? 'done' : begun && isLoading ? 'live' : 'pending'

        return {
            round,
            turns: [
                { target: turnId(round, 'pro'), voice: 'a', label: '正方发言', state: state(!!con || ruled || !!verdict, !!pro || started('pro')) },
                { target: turnId(round, 'con'), voice: 'b', label: '反方发言', state: state(ruled || !!verdict, !!con || started('con')) },
                { target: turnId(round, 'judge'), voice: 'judge', label: '评审', state: state(ruled, !!pro && !!con) },
            ],
        }
    })
}

export function DebateRail() {
    return <TurnRail rounds={useDebateRail()} label="辩论进度" />
}

/** Rounds of the debate: 正方 on the left, 反方 on the right, the jury across. */
export function AgentDebateTranscript() {
    const { messages, thinkings, evaluations, currentRound, showThinking, showScores, models } = useAgentDebateStore()
    const rail = useDebateRail()
    const rounds = rail.filter(r => r.round <= Math.max(currentRound, 1))

    return (
        <div className="space-y-14">
            {rounds.map(({ round, turns }) => {
                const pro = messages.find(m => m.round === round && m.role === '正方')
                const con = messages.find(m => m.round === round && m.role === '反方')
                const proThinking = thinkings.find(t => t.round === round && t.side === 'pro')
                const conThinking = thinkings.find(t => t.round === round && t.side === 'con')
                const ruling = evaluations.find(e => e.round === round)
                const [proTurn, conTurn] = turns

                return (
                    <section key={round} aria-label={`第 ${round} 轮`} className="space-y-6">
                        <h2 className="flex items-center gap-3">
                            <span className="numeral text-[1.25rem] text-ink-2">{round}</span>
                            <span className="t-meta">第 {round} 轮</span>
                            <span className="flex-1 h-px bg-line" aria-hidden="true" />
                        </h2>

                        {(pro || proThinking) && (
                            <Utterance
                                id={turnId(round, 'pro')}
                                voice="a"
                                speaker="正方"
                                meta={models?.pro}
                                content={pro?.content}
                                streaming={proTurn.state === 'live'}
                                before={showThinking && proThinking ? <ThinkingBubble thinking={proThinking} /> : null}
                            />
                        )}

                        {(con || conThinking) && (
                            <Utterance
                                id={turnId(round, 'con')}
                                voice="b"
                                speaker="反方"
                                meta={models?.con}
                                content={con?.content}
                                streaming={conTurn.state === 'live'}
                                align="end"
                                before={showThinking && conThinking ? <ThinkingBubble thinking={conThinking} /> : null}
                            />
                        )}

                        {showScores && ruling && <RoundRuling id={turnId(round, 'judge')} evaluation={ruling} />}
                    </section>
                )
            })}
        </div>
    )
}
