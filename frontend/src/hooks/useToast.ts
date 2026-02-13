import { useToastStore } from '@/stores/toastStore'

export function useToast() {
    const { success, error, info, warning } = useToastStore()
    return { success, error, info, warning }
}
