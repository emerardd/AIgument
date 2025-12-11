import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { chatAPI } from '@/services/api'
import type { ChatMessage } from '@/types'
import { CopyButton } from '@/components/ui/CopyButton'
import { Loader2, Send, Trash2, User, Sparkles, MessageCircle } from 'lucide-react'

export function ChatView() {
    const [inputMessage, setInputMessage] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const { messages, isLoading, error, addMessage, updateLastMessage, setLoading, setError, clear } =
        useChatStore()
    const { streamMode } = useSettingsStore()

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
    }

    const handleSend = async () => {
        if (!inputMessage.trim() || isLoading) return

        const userMessage: ChatMessage = {
            role: 'user',
            content: inputMessage.trim(),
        }

        addMessage(userMessage)
        setInputMessage('')
        setLoading(true)
        setError(null)
        scrollToBottom()

        const aiMessage: ChatMessage = {
            role: 'assistant',
            content: '',
        }
        addMessage(aiMessage)

        if (streamMode) {
            await chatAPI.streamChat(
                userMessage.content,
                (event) => {
                    if (event.type === 'content' && event.content) {
                        updateLastMessage(event.content)
                    } else if (event.type === 'complete') {
                        setLoading(false)
                    } else if (event.type === 'error') {
                        setError('回复生成出错')
                        setLoading(false)
                    }
                },
                (err) => {
                    setError(err.message)
                    setLoading(false)
                }
            )
        } else {
            try {
                const response = await chatAPI.sendMessage(userMessage.content)
                updateLastMessage(response.data.content || '无回复')
                setLoading(false)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : '未知错误')
                setLoading(false)
            }
        }

        inputRef.current?.focus()
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-w-3xl mx-auto">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-6">
                            <MessageCircle className="w-10 h-10 text-primary/60" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-foreground/80">开始对话</h3>
                        <p className="text-muted-foreground text-sm max-w-sm">
                            输入你想聊的话题，AI 将与你展开深度交流
                        </p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex gap-4 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            {/* Avatar */}
                            <div
                                className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-soft-sm ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-500 to-cyan-400'
                                    : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                                    }`}
                            >
                                {msg.role === 'user' ? (
                                    <User className="h-5 w-5 text-white" />
                                ) : (
                                    <Sparkles className="h-5 w-5 text-white" />
                                )}
                            </div>

                            {/* Message Bubble */}
                            <div
                                className={`relative group max-w-[75%] rounded-2xl px-5 py-3 shadow-soft-sm ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-tr-md'
                                    : 'glass rounded-tl-md'
                                    }`}
                            >
                                {msg.content ? (
                                    msg.role === 'user' ? (
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    ) : (
                                        <>
                                            <div className="text-foreground">
                                                <MarkdownRenderer content={msg.content} />
                                            </div>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <CopyButton text={msg.content} />
                                            </div>
                                        </>
                                    )
                                ) : (
                                    <div className="flex items-center gap-2 text-muted-foreground py-1">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">思考中...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Error Alert */}
            {error && (
                <div className="mx-4 mb-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                    {error}
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 glass border-t border-border/50">
                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={clear}
                        disabled={messages.length === 0 || isLoading}
                        className="rounded-xl text-muted-foreground hover:text-foreground shrink-0"
                        title="清空对话"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Input
                        ref={inputRef}
                        placeholder="输入消息..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        disabled={isLoading}
                        className="flex-1 rounded-xl border-0 bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!inputMessage.trim() || isLoading}
                        className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-soft-sm shrink-0"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
