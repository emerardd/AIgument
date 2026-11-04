import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { historyAPI } from '@/services/api'
import { presetTopics } from '@/config/presetTopics'
import type { HistoryItem } from '@/types'
import type { TopicHandoff } from '@/hooks/useInitialTopic'
import { SESSION_TYPE_LABELS, STATUS_LABELS, formatShortDate } from '@/utils/sessionLabels'

type ModeId = 'agent' | 'dialectic' | 'dual' | 'qa'

const MODES: { id: ModeId; label: string; hint: string; to: string; cta: string }[] = [
    { id: 'agent', label: '对抗辩论', hint: '正反方各执一词，评审逐轮打分', to: '/debate', cta: '开始辩论' },
    { id: 'dialectic', label: '辩证推演', hint: '正题、反题、合题，一轮轮推进', to: '/debate?mode=dialectic', cta: '开始推演' },
    { id: 'dual', label: '角色对话', hint: '两个性格不同的人聊这件事', to: '/dual-chat', cta: '开始对话' },
    { id: 'qa', label: '问答', hint: '用提问帮你自己想清楚', to: '/socratic-qa', cta: '去提问' },
]

// One topic from each category, so the suggestions cover different ground.
const SUGGESTIONS = presetTopics.map(category => category.topics[0]).slice(0, 4)

export default function Home() {
    const [topic, setTopic] = useState('')
    const [mode, setMode] = useState<ModeId>('agent')
    const [recent, setRecent] = useState<HistoryItem[] | null>(null)
    const navigate = useNavigate()
    const current = MODES.find(m => m.id === mode)!

    useEffect(() => {
        let active = true
        historyAPI.getHistory('all', 5)
            .then(res => { if (active) setRecent(res.data.history) })
            .catch(() => { if (active) setRecent([]) })
        return () => { active = false }
    }, [])

    const start = () => {
        const state: TopicHandoff = { topic: topic.trim() }
        navigate(current.to, { state })
    }

    return (
        <div className="mx-auto w-full max-w-[960px] px-[clamp(16px,4vw,56px)] pt-12 sm:pt-24 pb-24">
            <h1 className="display text-[2.75rem] sm:text-[4rem]">今天辩什么？</h1>

            <form
                className="mt-8 sm:mt-10"
                onSubmit={(e) => { e.preventDefault(); start() }}
            >
                <label htmlFor="home-topic" className="sr-only">话题</label>
                <div className="relative">
                    <span className="stone stone-pro absolute left-0 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                        id="home-topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="写下一个有分歧的话题"
                        className="w-full bg-transparent border-0 border-b-2 border-ink pl-6 pr-6 py-3 text-xl sm:text-2xl outline-none placeholder:text-ink-3 focus-visible:outline-none focus:border-pro"
                        autoComplete="off"
                    />
                    <span className="stone stone-con absolute right-0 top-1/2 -translate-y-1/2" aria-hidden="true" />
                </div>

                <fieldset className="mt-8">
                    <legend className="text-sm text-ink-3 mb-3">用什么方式</legend>
                    <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-line divide-x divide-line max-sm:[&>label:nth-child(n+3)]:border-t max-sm:[&>label:nth-child(3)]:border-l-0">
                        {MODES.map(m => {
                            const selected = m.id === mode
                            return (
                                <label
                                    key={m.id}
                                    className={`relative cursor-pointer px-3 sm:px-4 py-4 transition-colors ${selected ? 'bg-surface' : 'hover:bg-surface/60'}`}
                                >
                                    <input
                                        type="radio"
                                        name="mode"
                                        value={m.id}
                                        checked={selected}
                                        onChange={() => setMode(m.id)}
                                        className="sr-only peer"
                                    />
                                    {selected && <span className="absolute inset-x-0 top-0 h-[2px] bg-ink" aria-hidden="true" />}
                                    <span className={`block font-medium ${selected ? 'text-ink' : 'text-ink-2'}`}>{m.label}</span>
                                    <span className="block mt-1 text-[0.8125rem] leading-snug text-ink-3">{m.hint}</span>
                                    <span className="absolute inset-0 rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)] peer-focus-visible:-outline-offset-2" aria-hidden="true" />
                                </label>
                            )
                        })}
                    </div>
                </fieldset>

                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                    <button type="submit" className="btn-ink h-11 px-6">{current.cta}</button>
                    <p className="text-sm text-ink-3">
                        话题可以留空，进入后再填。
                    </p>
                </div>
            </form>

            <section className="mt-12" aria-labelledby="suggestions">
                <h2 id="suggestions" className="text-sm font-sans font-normal text-ink-3 mb-3">没想好？试试这些</h2>
                <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map(s => (
                        <button key={s} type="button" onClick={() => setTopic(s)} className="chip">{s}</button>
                    ))}
                </div>
            </section>

            <section className="mt-16" aria-labelledby="recent">
                <div className="flex items-baseline justify-between mb-2">
                    <h2 id="recent" className="text-xl">最近</h2>
                    <Link to="/history" className="text-sm text-ink-2 hover:text-ink underline-offset-4 hover:underline">全部历史</Link>
                </div>
                {recent === null ? (
                    <p className="text-sm text-ink-3 py-4">正在读取…</p>
                ) : recent.length === 0 ? (
                    <p className="text-sm text-ink-3 py-4 border-t border-line">还没有记录。完成的辩论、对话和问答都会出现在这里。</p>
                ) : (
                    <ul className="border-t border-line">
                        {recent.map(item => (
                            <li key={item.session_id} className="flex items-baseline gap-4 py-3 border-b border-line">
                                <span className="w-16 shrink-0 text-[0.8125rem] text-ink-3">{SESSION_TYPE_LABELS[item.type] ?? item.type}</span>
                                <span className="flex-1 min-w-0 truncate">{item.topic || '未命名'}</span>
                                {item.status && STATUS_LABELS[item.status] && (
                                    <span className="shrink-0 text-[0.8125rem] text-ink-2">{STATUS_LABELS[item.status]}</span>
                                )}
                                <time className="shrink-0 text-[0.8125rem] text-ink-3 tabular-nums" dateTime={item.start_time}>
                                    {formatShortDate(item.start_time)}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}
