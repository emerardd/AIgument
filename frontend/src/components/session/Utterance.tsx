import { lazy, Suspense, type ReactNode } from 'react'
import { CopyButton } from '@/components/ui/CopyButton'
import type { Voice } from './TurnRail'

const MarkdownRenderer = lazy(() =>
    import('@/components/ui/MarkdownRenderer').then((module) => ({ default: module.MarkdownRenderer }))
)

const MARK: Record<Voice, string> = { a: 'stone-pro', b: 'stone-con', judge: 'stone-jury' }
const NAME: Record<Voice, string> = { a: 'text-pro', b: 'text-con', judge: 'text-jury' }
const EDGE: Record<Voice, string> = { a: 'var(--voice-a)', b: 'var(--voice-b)', judge: 'var(--judge)' }

interface UtteranceProps {
    id?: string
    voice: Voice
    speaker: string
    /** Small facts shown after the speaker name, e.g. model or confidence. */
    meta?: ReactNode
    content?: string
    streaming?: boolean
    /** Shown above the text, e.g. a folded "思路" disclosure. */
    before?: ReactNode
    after?: ReactNode
    /** Where the block sits in a two-voice layout. */
    align?: 'start' | 'end' | 'center'
}

/** One turn of speech. Every mode renders speech through this block. */
export function Utterance({ id, voice, speaker, meta, content, streaming, before, after, align = 'start' }: UtteranceProps) {
    return (
        <article
            id={id}
            className={`scroll-mt-40 w-full ${align === 'center' ? '' : 'sm:w-[88%]'} ${align === 'end' ? 'sm:ml-auto' : ''}`}
            aria-label={`${speaker}的发言`}
        >
            <header className="flex items-baseline gap-2 mb-2 px-1">
                <span className={`stone ${MARK[voice]} self-center`} aria-hidden="true" />
                <span className={`font-medium ${NAME[voice]}`}>{speaker}</span>
                {meta && <span className="t-meta">{meta}</span>}
            </header>

            {before && <div className="mb-2 px-1">{before}</div>}

            <div
                className="group relative panel px-5 sm:px-6 py-4 sm:py-5"
                style={{ boxShadow: `inset 3px 0 0 ${EDGE[voice]}, var(--shadow-card)` }}
            >
                {content ? (
                    <>
                        <Suspense fallback={<p className="whitespace-pre-wrap">{content}</p>}>
                            <MarkdownRenderer content={content} className={streaming ? '[&>*:last-child]:streaming' : ''} />
                        </Suspense>
                        {!streaming && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <CopyButton text={content} />
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-ink-3 streaming">正在组织发言</p>
                )}
                {after}
            </div>
        </article>
    )
}
