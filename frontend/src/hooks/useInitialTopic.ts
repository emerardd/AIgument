import { useState } from 'react'
import { useLocation } from 'react-router-dom'

export interface TopicHandoff {
    topic?: string
}

/** Topic handed over from the home page through router state, read once on mount. */
export function useInitialTopic(): string {
    const location = useLocation()
    const [topic] = useState(() => (location.state as TopicHandoff | null)?.topic ?? '')
    return topic
}
