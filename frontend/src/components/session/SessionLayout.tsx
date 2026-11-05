import type { ReactNode } from 'react'

interface SessionLayoutProps {
    /** Small line above the topic, e.g. "3 轮对抗辩论". */
    kicker: ReactNode
    topic: string
    rail: ReactNode
    side: ReactNode
    error?: string | null
    children: ReactNode
}

/**
 * Frame shared by every running session: topic, the sticky turn rail,
 * the turns themselves, and a side panel (score, settings, actions)
 * that sits on the right on wide screens and below on narrow ones.
 */
export function SessionLayout({ kicker, topic, rail, side, error, children }: SessionLayoutProps) {
    return (
        <div>
            <header className="mb-5">
                <p className="t-meta">{kicker}</p>
                <h2 className="display text-[1.75rem] sm:text-[2.5rem] mt-1 max-w-[48rem] break-words">{topic}</h2>
            </header>

            <div className="sticky top-[60px] md:top-0 z-20 -mx-[clamp(16px,4vw,56px)] px-[clamp(16px,4vw,56px)] py-3 bg-page/90 backdrop-blur-md border-b border-line">
                {rail}
            </div>

            <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_288px] gap-8 lg:gap-10 items-start">
                <div className="min-w-0 space-y-14">
                    {error && (
                        <div className="panel px-5 py-4 t-small" style={{ boxShadow: 'inset 3px 0 0 var(--danger), var(--shadow-card)' }} role="alert">
                            {error}
                        </div>
                    )}
                    {children}
                </div>
                <aside className="space-y-4 lg:sticky lg:top-24 self-start" aria-label="会话信息">
                    {side}
                </aside>
            </div>
        </div>
    )
}

/** Primary/secondary actions at the bottom of the side panel. */
export function SideActions({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-2">{children}</div>
}
