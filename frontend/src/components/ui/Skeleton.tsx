import { cn } from '@/utils/helpers'

interface SkeletonProps {
    className?: string
}

/**
 * 基础骨架屏组件
 */
export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-lg bg-muted/60',
                className
            )}
        />
    )
}

/**
 * 消息骨架屏 - 用于聊天/问答消息加载
 */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
    return (
        <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <Skeleton className="w-10 h-10 rounded-2xl shrink-0" />

            {/* Message */}
            <div className={`max-w-[70%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                <Skeleton className="h-4 w-16" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-56" />
                </div>
            </div>
        </div>
    )
}

/**
 * 聊天区域骨架屏
 */
export function ChatSkeleton() {
    return (
        <div className="space-y-6 p-4">
            <MessageSkeleton />
            <MessageSkeleton isUser />
            <MessageSkeleton />
        </div>
    )
}

/**
 * 卡片骨架屏 - 用于历史记录等列表
 */
export function CardSkeleton() {
    return (
        <div className="p-4 rounded-xl border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
            </div>
        </div>
    )
}

/**
 * 历史记录列表骨架屏
 */
export function HistoryListSkeleton() {
    return (
        <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
        </div>
    )
}

/**
 * 设置页面骨架屏
 */
export function SettingsSkeleton() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 rounded-2xl border border-border/50 space-y-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-2xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-10 w-32 rounded-xl" />
                        <Skeleton className="h-10 w-32 rounded-xl" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * 全页加载骨架屏
 */
export function PageSkeleton() {
    return (
        <div className="min-h-screen gradient-bg p-8 space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
                <Skeleton className="h-8 w-32 mx-auto rounded-full" />
                <Skeleton className="h-10 w-64 mx-auto" />
                <Skeleton className="h-5 w-96 mx-auto" />
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto">
                <ChatSkeleton />
            </div>
        </div>
    )
}
