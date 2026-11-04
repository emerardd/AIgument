import { useSearchParams } from 'react-router-dom'
import { Page } from '@/components/layout/Page'
import { AgentDebateView } from '@/components/debate/AgentDebateView'
import { DialecticView } from '@/components/dialectic/DialecticView'

type DebateMode = 'agent' | 'dialectic'

const MODES: Record<DebateMode, { label: string; description: string }> = {
    agent: {
        label: '对抗辩论',
        description: '正反两方各自审题、选策略、发言，评审每轮打分，最后给出裁决。',
    },
    dialectic: {
        label: '辩证推演',
        description: '从一个观点出发，提出反题，再综合成新的观点，一轮一轮往前推。',
    },
}

function parseDebateMode(value: string | null): DebateMode {
    return value === 'dialectic' ? 'dialectic' : 'agent'
}

export default function DebatePage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const mode = parseDebateMode(searchParams.get('mode'))

    const switchMode = (next: DebateMode) => {
        setSearchParams(next === 'agent' ? {} : { mode: next }, { replace: true })
    }

    return (
        <Page
            title={MODES[mode].label}
            description={MODES[mode].description}
            aside={
                <div role="tablist" aria-label="辩论方式" className="segmented">
                    {(Object.keys(MODES) as DebateMode[]).map((key) => (
                        <button key={key} role="tab" aria-selected={key === mode} onClick={() => switchMode(key)}>
                            {MODES[key].label}
                        </button>
                    ))}
                </div>
            }
        >
            {/* Both views stay mounted so switching tabs does not cancel a running session. */}
            <div hidden={mode !== 'agent'}><AgentDebateView /></div>
            <div hidden={mode !== 'dialectic'}><DialecticView /></div>
        </Page>
    )
}
