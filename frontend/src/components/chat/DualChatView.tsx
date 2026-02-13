import { useState, useEffect, useRef } from 'react'
import { Users, Play, MessageCircle, Sparkles, RefreshCw } from 'lucide-react'
import { API_BASE_URL } from '@/config/env'
import { streamSSE } from '@/utils/sse'

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

interface DualChatStreamEvent {
    type: 'start' | 'message' | 'message_complete' | 'complete' | 'error'
    speaker?: string
    role_id?: 'a' | 'b'
    content?: string
    turn?: number
    error?: string
}

export function DualChatView() {
    const [topic, setTopic] = useState('')
    const [roles, setRoles] = useState<Role[]>([])
    const [rolesLoading, setRolesLoading] = useState(true)
    const [roleA, setRoleA] = useState('乐观主义者')
    const [roleB, setRoleB] = useState('现实主义者')
    const [turns, setTurns] = useState(3)
    const [messages, setMessages] = useState<Message[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [currentSpeaker, setCurrentSpeaker] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // 获取可用角色
    useEffect(() => {
        setRolesLoading(true)
        fetch(`${API_BASE_URL}/api/chat/roles`)
            .then(res => res.json())
            .then(data => {
                setRoles(data.roles || [])
                setRolesLoading(false)
            })
            .catch(err => {
                console.error('Failed to fetch roles:', err)
                setRolesLoading(false)
            })
    }, [])

    // 自动滚动
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const startConversation = async () => {
        if (!topic.trim()) {
            setError('请输入对话主题')
            return
        }

        setIsRunning(true)
        setMessages([])
        setError(null)

        try {
            const params = new URLSearchParams({
                topic,
                role_a: roleA,
                role_b: roleB,
                turns: turns.toString(),
            })

            await streamSSE<DualChatStreamEvent>({
                url: `${API_BASE_URL}/api/chat/dual-stream?${params.toString()}`,
                onEvent: handleEvent,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsRunning(false)
            setCurrentSpeaker('')
        }
    }

    const handleEvent = (event: DualChatStreamEvent) => {
        switch (event.type) {
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

    const getRoleInfo = (roleId: string) => {
        const roleName = roleId === 'a' ? roleA : roleB
        return roles.find(r => r.id === roleName)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <div className="container max-w-4xl mx-auto px-4 py-8">
                {/* 头部 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 mb-4">
                        <Users className="w-5 h-5 text-primary" />
                        <span className="font-medium">双角色对话</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-2">AI 角色对话</h1>
                    <p className="text-muted-foreground">
                        选择两个不同性格的 AI 角色，围绕一个话题进行对话
                    </p>
                </div>

                {/* 设置区域 */}
                <div className="bg-card rounded-2xl border shadow-sm p-6 mb-6">
                    <div className="space-y-4">
                        {/* 话题输入 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">对话主题</label>
                            <input
                                type="text"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                placeholder="例如：远程办公的利弊、人工智能的未来..."
                                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                disabled={isRunning}
                            />
                        </div>

                        {/* 角色选择 */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">角色 A</label>
                                <select
                                    value={roleA}
                                    onChange={e => setRoleA(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/30 focus:border-blue-500 outline-none"
                                    disabled={isRunning || rolesLoading}
                                >
                                    {rolesLoading ? (
                                        <option value="">加载中...</option>
                                    ) : roles.length === 0 ? (
                                        <option value="乐观主义者">乐观主义者 (默认)</option>
                                    ) : (
                                        roles.map(role => (
                                            <option key={role.id} value={role.id}>
                                                {role.name} - {role.persona.slice(0, 20)}...
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">角色 B</label>
                                <select
                                    value={roleB}
                                    onChange={e => setRoleB(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-orange-500/5 border border-orange-500/30 focus:border-orange-500 outline-none"
                                    disabled={isRunning || rolesLoading}
                                >
                                    {rolesLoading ? (
                                        <option value="">加载中...</option>
                                    ) : roles.length === 0 ? (
                                        <option value="现实主义者">现实主义者 (默认)</option>
                                    ) : (
                                        roles.map(role => (
                                            <option key={role.id} value={role.id}>
                                                {role.name} - {role.persona.slice(0, 20)}...
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* 轮次设置 */}
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-medium">对话轮次</label>
                            <div className="flex items-center gap-2">
                                {[2, 3, 4, 5].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setTurns(n)}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${turns === n
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80'
                                            }`}
                                        disabled={isRunning}
                                    >
                                        {n} 轮
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 开始按钮 */}
                        <button
                            onClick={startConversation}
                            disabled={isRunning || !topic.trim()}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {isRunning ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    对话进行中...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    开始对话
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 错误提示 */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
                        {error}
                    </div>
                )}

                {/* 对话区域 */}
                {messages.length > 0 && (
                    <div className="bg-card rounded-2xl border shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageCircle className="w-5 h-5 text-primary" />
                            <span className="font-medium">对话记录</span>
                            {currentSpeaker && (
                                <span className="ml-auto text-sm text-muted-foreground animate-pulse">
                                    {currentSpeaker} 正在说...
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {messages.map((msg) => {
                                const isRoleA = msg.role_id === 'a'
                                const roleInfo = getRoleInfo(msg.role_id)

                                return (
                                    <div
                                        key={`${msg.turn}-${msg.role_id}`}
                                        className={`flex ${isRoleA ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div
                                            className={`
                                                max-w-[80%] p-4 rounded-2xl
                                                ${isRoleA
                                                    ? 'bg-blue-500/10 border border-blue-500/20 rounded-tl-sm'
                                                    : 'bg-orange-500/10 border border-orange-500/20 rounded-tr-sm'
                                                }
                                                ${!msg.isComplete ? 'animate-pulse' : ''}
                                            `}
                                        >
                                            <div className={`text-xs font-medium mb-2 ${isRoleA ? 'text-blue-500' : 'text-orange-500'}`}>
                                                {msg.speaker}
                                                {roleInfo && (
                                                    <span className="text-muted-foreground ml-2">
                                                        ({roleInfo.persona.slice(0, 15)}...)
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}

                {/* 空状态 */}
                {messages.length === 0 && !isRunning && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>输入话题并选择角色，开始一场有趣的对话</p>
                    </div>
                )}
            </div>
        </div>
    )
}
