import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

interface CopyButtonProps {
    text: string
    className?: string
    size?: 'sm' | 'md'
}

export function CopyButton({ text, className = '', size = 'sm' }: CopyButtonProps) {
    const [copied, setCopied] = useState(false)
    const toast = useToast()

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            toast.success('已复制到剪贴板')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('复制失败')
        }
    }

    const sizeClasses = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
    const iconClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

    return (
        <button
            onClick={handleCopy}
            className={`
                ${sizeClasses} rounded flex items-center justify-center
                text-ink-3 hover:text-ink hover:bg-sunken transition-colors
                ${copied ? 'text-ink' : ''}
                ${className}
            `}
            title={copied ? '已复制' : '复制'}
            aria-label={copied ? '已复制' : '复制'}
        >
            {copied ? (
                <Check className={iconClasses} />
            ) : (
                <Copy className={iconClasses} />
            )}
        </button>
    )
}
