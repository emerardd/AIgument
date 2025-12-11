import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    message: string
    type: ToastType
    duration?: number
}

interface ToastState {
    toasts: Toast[]
    addToast: (message: string, type?: ToastType, duration?: number) => void
    removeToast: (id: string) => void
    success: (message: string, duration?: number) => void
    error: (message: string, duration?: number) => void
    info: (message: string, duration?: number) => void
    warning: (message: string, duration?: number) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],

    addToast: (message, type = 'info', duration = 3000) => {
        const id = crypto.randomUUID()
        const toast: Toast = { id, message, type, duration }

        set((state) => ({
            toasts: [...state.toasts, toast],
        }))

        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                get().removeToast(id)
            }, duration)
        }
    },

    removeToast: (id) =>
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        })),

    success: (message, duration) => get().addToast(message, 'success', duration),
    error: (message, duration) => get().addToast(message, 'error', duration),
    info: (message, duration) => get().addToast(message, 'info', duration),
    warning: (message, duration) => get().addToast(message, 'warning', duration),
}))
