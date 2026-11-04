export type Voice = 'a' | 'b' | 'judge'
export type TurnState = 'done' | 'live' | 'pending'

export interface RailTurn {
    /** DOM id of the block this segment jumps to. */
    target: string
    voice: Voice
    label: string
    state: TurnState
}

export interface RailRound {
    round: number
    turns: RailTurn[]
}

const FILL: Record<Voice, string> = {
    a: 'bg-pro',
    b: 'bg-con',
    judge: 'bg-jury',
}

/**
 * The turn rail: one group per round, one segment per turn, colored by voice.
 * Finished turns are solid, the live turn pulses, upcoming turns are outlines.
 * Clicking a segment scrolls to that turn. Shared by every session view.
 */
export function TurnRail({ rounds, label }: { rounds: RailRound[]; label: string }) {
    const jump = (target: string) => {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
        <nav aria-label={label} className="flex items-end gap-3 sm:gap-4 overflow-x-auto pb-1">
            {rounds.map(group => (
                <div key={group.round} className="flex flex-col gap-1.5 min-w-[3.5rem] flex-1 max-w-[12rem]">
                    <span className="numeral text-[0.8125rem] text-ink-3 leading-none">{group.round}</span>
                    <div className="flex gap-[3px]">
                        {group.turns.map(turn => (
                            <button
                                key={turn.target}
                                type="button"
                                onClick={() => jump(turn.target)}
                                disabled={turn.state === 'pending'}
                                title={`第 ${group.round} 轮 ${turn.label}`}
                                aria-label={`第 ${group.round} 轮 ${turn.label}${turn.state === 'live' ? '，进行中' : turn.state === 'pending' ? '，未开始' : ''}`}
                                className={`h-2 rounded-full transition-colors ${turn.voice === 'judge' ? 'w-3 shrink-0' : 'flex-1'} ${
                                    turn.state === 'pending'
                                        ? 'bg-sunken cursor-default'
                                        : turn.state === 'live'
                                            ? `${FILL[turn.voice]} animate-pulse`
                                            : `${FILL[turn.voice]} hover:opacity-75`
                                }`}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </nav>
    )
}
