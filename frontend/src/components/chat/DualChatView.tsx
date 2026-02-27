import { useState, useEffect, useRef } from 'react'
import { Users, Play, MessageCircle, Sparkles, RefreshCw, ChevronDown, Check } from 'lucide-react'
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
    const [openDropdown, setOpenDropdown] = useState<'a' | 'b' | null>(null)
    const dropdownRefA = useRef<HTMLDivElement>(null)
    const dropdownRefB = useRef<HTMLDivElement>(null)

    // 点击外部关闭下拉
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRefA.current && !dropdownRefA.current.contains(e.target as Node) &&
                dropdownRefB.current && !dropdownRefB.current.contains(e.target as Node)) {
                setOpenDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

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
        return roles.find(r => r.id === roleId)
    }

    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
                {/* 头部 */}
                <div className="text-center mb-8 sm:mb-12">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>双角色对话</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight animate-slide-up delay-100 opacity-0">
                        <span className="text-gradient">AI 角色</span>
                        <br />
                        <span className="text-foreground/80">多视角对话</span>
                    </h1>

                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up delay-200 opacity-0 px-4 sm:px-0">
                        选择两个不同性格的 AI 角色，围绕一个话题进行深度对话
                    </p>
                </div>

                {/* 话题输入 - 与 AgentDebateView 统一的开放式布局 */}
                <div className="relative max-w-3xl mx-auto mb-6 animate-elastic delay-300 opacity-0">
                    <div className="relative flex items-center gap-2 glass shadow-soft rounded-2xl p-2 sm:p-3">
                        <input
                            type="text"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder="例如：远程办公的利弊、人工智能的未来..."
                            className="flex-1 bg-transparent px-3 sm:px-4 py-2 sm:py-3 text-base sm:text-lg outline-none placeholder:text-muted-foreground/60"
                            disabled={isRunning}
                        />
                        <button
                            onClick={startConversation}
                            disabled={isRunning || !topic.trim()}
                            className="h-11 px-6 rounded-xl btn-primary shrink-0 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isRunning ? (
                                <RefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Play className="h-5 w-5" />
                                    <span className="hidden sm:inline">开始对话</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 设置面板 - 与 AgentDebateView 统一的居中面板 */}
                <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 animate-fade-in delay-200 opacity-0">
                    {/* 角色选择 */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground font-medium">角色</span>
                        <div className="flex items-center gap-2">
                            {/* 角色 A 选择器 */}
                            <div className="relative" ref={dropdownRefA}>
                                <button
                                    onClick={() => setOpenDropdown(openDropdown === 'a' ? null : 'a')}
                                    disabled={isRunning || rolesLoading}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200
                                        ${openDropdown === 'a'
                                            ? 'bg-primary/10 text-primary ring-2 ring-primary/20'
                                            : 'bg-muted/40 hover:bg-muted/60 text-foreground'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                >
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="max-w-[100px] truncate">{getRoleInfo(roleA)?.name || roleA}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'a' ? 'rotate-180' : ''}`} />
                                </button>
                                {openDropdown === 'a' && (
                                    <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-background border border-border shadow-2xl z-50 overflow-hidden animate-fade-in">
                                        <div className="max-h-60 overflow-y-auto p-1.5">
                                            {roles.map(role => (
                                                <button
                                                    key={role.id}
                                                    onClick={() => { setRoleA(role.id); setOpenDropdown(null) }}
                                                    className={`
                                                        w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group
                                                        ${roleA === role.id
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'hover:bg-muted/50 text-foreground'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-sm">{role.name}</span>
                                                        {roleA === role.id && <Check className="w-4 h-4 text-primary" />}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{role.persona}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <span className="text-xs text-muted-foreground font-bold">VS</span>

                            {/* 角色 B 选择器 */}
                            <div className="relative" ref={dropdownRefB}>
                                <button
                                    onClick={() => setOpenDropdown(openDropdown === 'b' ? null : 'b')}
                                    disabled={isRunning || rolesLoading}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200
                                        ${openDropdown === 'b'
                                            ? 'bg-primary/10 text-primary ring-2 ring-primary/20'
                                            : 'bg-muted/40 hover:bg-muted/60 text-foreground'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                >
                                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                                    <span className="max-w-[100px] truncate">{getRoleInfo(roleB)?.name || roleB}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'b' ? 'rotate-180' : ''}`} />
                                </button>
                                {openDropdown === 'b' && (
                                    <div className="absolute top-full right-0 mt-2 w-64 rounded-xl bg-background border border-border shadow-2xl z-50 overflow-hidden animate-fade-in">
                                        <div className="max-h-60 overflow-y-auto p-1.5">
                                            {roles.map(role => (
                                                <button
                                                    key={role.id}
                                                    onClick={() => { setRoleB(role.id); setOpenDropdown(null) }}
                                                    className={`
                                                        w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group
                                                        ${roleB === role.id
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'hover:bg-muted/50 text-foreground'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-sm">{role.name}</span>
                                                        {roleB === role.id && <Check className="w-4 h-4 text-primary" />}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{role.persona}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 分隔符 */}
                    <div className="hidden sm:block w-px h-8 bg-border/50" />

                    {/* 轮次选择 - 与 AgentDebateView 统一的双层药丸 */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground font-medium">对话轮次</span>
                        <div className="flex items-center bg-muted/30 rounded-xl p-1 gap-1">
                            {[
                                { n: 2, label: '快速', desc: '2轮' },
                                { n: 3, label: '标准', desc: '3轮' },
                                { n: 5, label: '深入', desc: '5轮' },
                            ].map(({ n, label, desc }) => (
                                <button
                                    key={n}
                                    onClick={() => setTurns(n)}
                                    className={`
                                        relative px-4 py-2 rounded-lg transition-all duration-300 text-sm font-medium
                                        flex flex-col items-center gap-0.5 min-w-[70px]
                                        ${turns === n
                                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                                            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                        }
                                    `}
                                    disabled={isRunning}
                                >
                                    <span className="text-xs opacity-80">{label}</span>
                                    <span className="font-bold">{desc}</span>
                                </button>
                            ))}
                            <div className="flex items-center gap-1 px-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={turns}
                                    onChange={(e) => {
                                        const v = Math.min(10, Math.max(1, Number(e.target.value) || 1))
                                        setTurns(v)
                                    }}
                                    disabled={isRunning}
                                    className="w-12 h-8 text-center text-sm font-bold rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none disabled:opacity-50"
                                />
                                <span className="text-xs text-muted-foreground">轮</span>
                            </div>
                        </div>
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
