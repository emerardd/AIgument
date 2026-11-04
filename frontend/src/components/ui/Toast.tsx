import { useToastStore, type ToastType } from '@/stores/toastStore'
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'

const iconMap: Record<ToastType, React.ElementType> = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
}

// Toasts are ink on board; the icon carries the kind, the text says what happened.
const iconColorMap: Record<ToastType, string> = {
    success: 'text-board',
    error: 'text-[var(--con-soft)]',
    info: 'text-board',
    warning: 'text-[var(--jury-soft)]',
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
                        role={toast.type === 'error' ? 'alert' : 'status'}
                        className="pointer-events-auto arrive flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-md bg-ink text-board min-w-[260px] max-w-md"
                    >
                        <Icon className={`w-4 h-4 shrink-0 ${iconColorMap[toast.type]}`} />
                        <span className="text-sm flex-1">{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1.5 rounded opacity-70 hover:opacity-100 shrink-0"
                            aria-label="关闭提示"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
