import { useToastStore, type ToastType } from '@/stores/toastStore'
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'

const iconMap: Record<ToastType, React.ElementType> = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
}

const styleMap: Record<ToastType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
}

const iconColorMap: Record<ToastType, string> = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    warning: 'text-amber-500',
}

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore()

    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => {
                const Icon = iconMap[toast.type]
                return (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
                            border backdrop-blur-md shadow-soft-lg
                            animate-slide-up min-w-[280px] max-w-md
                            ${styleMap[toast.type]}
                        `}
                    >
                        <Icon className={`w-5 h-5 shrink-0 ${iconColorMap[toast.type]}`} />
                        <span className="text-sm font-medium flex-1">{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

// 便捷的 hook，供组件使用
export function useToast() {
    const { success, error, info, warning } = useToastStore()
    return { success, error, info, warning }
}
