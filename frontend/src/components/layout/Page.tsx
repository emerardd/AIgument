import type { ReactNode } from 'react'

const WIDTHS = {
    reading: 'max-w-[760px]',
    wide: 'max-w-[1200px]',
    full: 'max-w-[1440px]',
} as const

interface PageProps {
    title: ReactNode
    description?: ReactNode
    /** Controls placed at the right of the title row (e.g. a mode switch). */
    aside?: ReactNode
    children: ReactNode
    width?: keyof typeof WIDTHS
}

/** Shared frame: centered column, fluid side gutters, one title row. */
export function Page({ title, description, aside, children, width = 'wide' }: PageProps) {
    return (
        <div className={`mx-auto w-full ${WIDTHS[width]} px-[clamp(16px,4vw,56px)] pt-8 sm:pt-12 pb-24`}>
            <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 mb-8 sm:mb-10">
                <div className="min-w-0">
                    <h1 className="display text-[2.5rem] sm:text-[3rem]">{title}</h1>
                    {description && <p className="mt-2 text-ink-2 max-w-[40rem]">{description}</p>}
                </div>
                {aside}
            </header>
            {children}
        </div>
    )
}
