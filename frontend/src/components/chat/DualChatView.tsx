import { useState, useEffect, useRef } from 'react'
import { RotateCcw, Square } from 'lucide-react'
import { SessionLayout, SideActions } from '@/components/session/SessionLayout'
import { TurnRail, type RailRound, type TurnState } from '@/components/session/TurnRail'
import { Utterance } from '@/components/session/Utterance'
import { Page } from '@/components/layout/Page'
import { useInitialTopic } from '@/hooks/useInitialTopic'
import { useStreamRun } from '@/hooks/useStreamRun'
import { useSettingsStore } from '@/stores/settingsStore'
import { chatAPI } from '@/services/api'
import type { DualChatStreamEvent } from '@/services/api'

interface Role {
    id: string
    name: string
    persona: string
    style: string
    position: string
}

interface Message {
    speaker: string
    role_id: 'a' | 'b'
    content: string
    turn: number
    isComplete: boolean
}

export function DualChatView() {
    const initialTopic = useInitialTopic()
    const [topic, setTopic] = useState(initialTopic)
    const [roles, setRoles] = useState<Role[]>([])
    const [rolesLoading, setRolesLoading] = useState(true)
    const [roleA, setRoleA] = useState('乐观主义者')
    const [roleB, setRoleB] = useState('现实主义者')
    const [turns, setTurns] = useState(3)
    const [messages, setMessages] = useState<Message[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [currentSpeaker, setCurrentSpeaker] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [active, setActive] = useState<{ topic: string; roleA: string; roleB: string; nameA: string; nameB: string; turns: number } | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const run = useStreamRun()
    const { defaultProvider, defaultModel } = useSettingsStore()

    useEffect(() => {
        chatAPI.getRoles()
            .then((res) => {
                setRoles(res.data.roles || [])
                setRolesLoading(false)
            })
            .catch(err => {
                console.error('Failed to fetch roles:', err)
                setRolesLoading(false)
            })
    }, [])

    // 自动滚动
    useEffect(() => {
        if (isRunning) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, [messages, isRunning])

    const startConversation = () => {
        if (!topic.trim()) {
            setError('请输入对话主题')
            return
        }

        setIsRunning(true)
        setMessages([])
        setError(null)
        setActive({
            topic: topic.trim(), roleA, roleB, turns,
            nameA: roles.find(r => r.id === roleA)?.name ?? roleA,
            nameB: roles.find(r => r.id === roleB)?.name ?? roleB,
        })

        void run.start<DualChatStreamEvent>(
            (onEvent, onError, signal) => chatAPI.streamDualChat(
                topic, roleA, roleB, turns, onEvent, onError, defaultProvider, defaultModel, signal,
            ),
            {
                onEvent: handleEvent,
                onFinish: (outcome, message) => {
                    setIsRunning(false)
                    setCurrentSpeaker('')
                    if (outcome === 'failed' || outcome === 'truncated') setError(message || 'Unknown error')
                },
            },
        )
    }

    const stopConversation = () => run.cancel()

    const handleEvent = (event: DualChatStreamEvent) => {
        switch (event.type) {
            case 'session':
                break
            case 'start':
                // 对话开始
                break

            case 'message':
                {
                    if (!event.speaker || !event.role_id || event.turn === undefined || event.content === undefined) {
                        break
                    }
                    const { speaker, role_id, turn, content } = event
                    setCurrentSpeaker(speaker)
                    setMessages(prev => {
                        const existing = prev.find(m => m.turn === turn && m.role_id === role_id)
                        if (existing) {
                            return prev.map(m =>
                                m.turn === turn && m.role_id === role_id
                                    ? { ...m, content }
                                    : m
                            )
                        }
                        return [...prev, {
                            speaker,
                            role_id,
                            content,
                            turn,
                            isComplete: false
                        }]
                    })
                    break
                }

            case 'message_complete':
                {
                    if (!event.role_id || event.turn === undefined || event.content === undefined) {
                        break
                    }
                    const {
                        role_id: completeRoleId,
                        turn: completeTurn,
                        content: completeContent,
                    } = event
                    setMessages(prev =>
                        prev.map(m =>
                            m.turn === completeTurn && m.role_id === completeRoleId
                                ? { ...m, content: completeContent, isComplete: true }
                                : m
                        )
                    )
                    break
                }

            case 'complete':
                setCurrentSpeaker('')
                break

            case 'error':
                setError(event.error || 'Unknown error')
                break
        }
    }

    const renderRolePicker = (slot: 'a' | 'b', value: string, onChange: (id: string) => void) => (
        <fieldset disabled={isRunning || rolesLoading} className="min-w-0">
            <legend className="flex items-center gap-2 t-small text-ink-2 mb-2">
                <span className={`stone stone-${slot === 'a' ? 'pro' : 'con'}`} aria-hidden="true" />
                {slot === 'a' ? '先开口的人' : '接话的人'}
            </legend>
            {rolesLoading ? (
                <p className="text-sm text-ink-3">正在读取角色…</p>
            ) : (
                <div className="border-t border-line">
                    {roles.map(role => {
                        const selected = value === role.id
                        return (
                            <label
                                key={role.id}
                                className={`flex gap-3 items-baseline py-2.5 px-2 -mx-2 border-b border-line cursor-pointer rounded-sm ${selected ? 'bg-surface' : 'hover:bg-surface/60'}`}
                            >
                                <input
                                    type="radio"
                                    name={`role-${slot}`}
                                    value={role.id}
                                    checked={selected}
                                    onChange={() => onChange(role.id)}
                                    className="accent-[var(--ink)] translate-y-[1px]"
                                />
                                <span className="min-w-0">
                                    <span className={`block text-[0.9375rem] ${selected ? 'text-ink font-medium' : 'text-ink-2'}`}>{role.name}</span>
                                    <span className="block text-[0.8125rem] text-ink-3 line-clamp-1">{role.persona}</span>
                                </span>
                            </label>
                        )
                    })}
                </div>
            )}
        </fieldset>
    )

    const roleName = (id: string) => roles.find(r => r.id === id)?.name ?? id

    if (!active) {
        return (
            <Page width="full" title="角色对话" description="选两个性格不同的人，让他们围绕一个话题聊下去。">
                <form
                    className="panel px-5 sm:px-8 py-6 sm:py-8 max-w-[960px] space-y-8"
                    onSubmit={(e) => { e.preventDefault(); startConversation() }}
                >
                    <div>
                        <label htmlFor="dual-topic" className="block t-small text-ink-2 mb-2">话题</label>
                        <div className="field flex items-center gap-2 pl-4 pr-1.5 py-1.5">
                            <input
                                id="dual-topic"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                placeholder="远程办公的利弊"
                                className="flex-1 min-w-0 h-10 text-[1.0625rem] placeholder:text-ink-3"
                                autoComplete="off"
                            />
                            <button type="submit" disabled={!topic.trim()} className="btn-ink shrink-0">开始对话</button>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-x-10 gap-y-6">
                        {renderRolePicker('a', roleA, setRoleA)}
                        {renderRolePicker('b', roleB, setRoleB)}
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="t-small text-ink-2">来回几次</span>
                        <div className="segmented" role="group" aria-label="对话轮数">
                            {[2, 3, 5].map(n => (
                                <button key={n} type="button" aria-pressed={turns === n} onClick={() => setTurns(n)}>{n}</button>
                            ))}
                        </div>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={turns}
                            onChange={(e) => setTurns(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                            className="field w-14 h-8 text-center t-small tabular-nums"
                            aria-label="自定义轮数"
                        />
                    </div>
                    {error && <p className="t-small text-destructive" role="alert">{error}</p>}
                </form>
            </Page>
        )
    }

    // A speaks first, then B answers: message n belongs to round ceil(n / 2).
    const rail: RailRound[] = Array.from({ length: active.turns }, (_, i) => {
        const round = i + 1
        const state = (turnNo: number): TurnState => {
            const msg = messages.find(m => m.turn === turnNo)
            return !msg ? 'pending' : msg.isComplete ? 'done' : 'live'
        }
        return {
            round,
            turns: [
                { target: `t${round * 2 - 1}`, voice: 'a', label: active.nameA, state: state(round * 2 - 1) },
                { target: `t${round * 2}`, voice: 'b', label: active.nameB, state: state(round * 2) },
            ],
        }
    })

    return (
        <Page width="full" title="角色对话" description="选两个性格不同的人，让他们围绕一个话题聊下去。">
            <SessionLayout
                kicker={`${active.nameA} 和 ${active.nameB}，${active.turns} 个来回`}
                topic={active.topic}
                rail={<TurnRail rounds={rail} label="对话进度" />}
                error={error}
                side={
                    <>
                        <div className="panel px-5 py-4 space-y-4">
                            {(['a', 'b'] as const).map(slot => {
                                const role = roles.find(r => r.id === (slot === 'a' ? active.roleA : active.roleB))
                                return (
                                    <div key={slot}>
                                        <p className="flex items-center gap-2 font-medium">
                                            <span className={`stone stone-${slot === 'a' ? 'pro' : 'con'}`} aria-hidden="true" />
                                            <span className={slot === 'a' ? 'text-pro' : 'text-con'}>{slot === 'a' ? active.nameA : active.nameB}</span>
                                        </p>
                                        {role?.persona && <p className="t-small text-ink-2 mt-1">{role.persona}</p>}
                                    </div>
                                )
                            })}
                        </div>
                        <SideActions>
                            {isRunning ? (
                                <button type="button" onClick={stopConversation} className="btn-ink w-full">
                                    <Square className="h-3.5 w-3.5" fill="currentColor" />停止对话
                                </button>
                            ) : (
                                <button type="button" onClick={() => { setActive(null); setMessages([]); setError(null) }} className="btn-ink w-full">
                                    <RotateCcw className="h-4 w-4" />换个话题
                                </button>
                            )}
                        </SideActions>
                    </>
                }
            >
                {isRunning && messages.length === 0 && <p className="text-ink-3 streaming" role="status">{active.nameA}正在想怎么开口</p>}
                <div className="space-y-8">
                    {messages.map((msg) => (
                        <Utterance
                            key={`${msg.turn}-${msg.role_id}`}
                            id={`t${msg.turn}`}
                            voice={msg.role_id === 'a' ? 'a' : 'b'}
                            align={msg.role_id === 'a' ? 'start' : 'end'}
                            speaker={msg.speaker || roleName(msg.role_id === 'a' ? active.roleA : active.roleB)}
                            content={msg.content}
                            streaming={!msg.isComplete}
                        />
                    ))}
                </div>
                {currentSpeaker && <p className="sr-only" role="status">{currentSpeaker} 正在说</p>}
                <div ref={messagesEndRef} />
            </SessionLayout>
        </Page>
    )
}
