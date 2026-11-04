import type { ReactNode } from 'react'

interface PageProps {
    title: ReactNode
    description?: ReactNode
    /** Controls placed at the right of the title row (e.g. a mode switch). */
    aside?: ReactNode
    children: ReactNode
    width?: 'reading' | 'wide'
}

/** Left-aligned page frame shared by every screen. */
export function Page({ title, description, aside, children, width = 'wide' }: PageProps) {
    return (
        <div className={`px-5 sm:px-10 pt-8 sm:pt-12 pb-20 ${width === 'reading' ? 'max-w-3xl' : 'max-w-6xl'}`}>
            <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 mb-8 sm:mb-10">
                <div className="min-w-0">
                    <h1 className="display text-[2rem] sm:text-[2.5rem]">{title}</h1>
                    {description && <p className="mt-2 text-ink-2 max-w-[38rem]">{description}</p>}
                </div>
                {aside}
            </header>
            {children}
        </div>
    )
}
