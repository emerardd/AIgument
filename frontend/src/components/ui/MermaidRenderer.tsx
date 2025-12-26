import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

interface MermaidRendererProps {
    code: string
    className?: string
}

// 初始化 Mermaid 配置
let initialized = false

function initMermaid() {
    if (initialized) return

    mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#fff',
            primaryBorderColor: '#3b82f6',
            secondaryColor: '#f97316',
            tertiaryColor: '#1e1e2e',
            background: '#0a0a0f',
            mainBkg: '#1e1e2e',
            lineColor: '#6b7280',
            textColor: '#e5e7eb',
        },
        flowchart: {
            curve: 'basis',
            padding: 20,
        },
    })
    initialized = true
}

export function MermaidRenderer({ code, className = '' }: MermaidRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [isRendering, setIsRendering] = useState(true)

    useEffect(() => {
        // 如果没有代码，直接结束渲染状态
        if (!code) {
            setIsRendering(false)
            setError('没有图表数据')
            return
        }

        initMermaid()

        const renderDiagram = async () => {
            setIsRendering(true)
            setError(null)

            try {
                // 生成唯一 ID
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

                // 验证并渲染
                const { svg: renderedSvg } = await mermaid.render(id, code)
                setSvg(renderedSvg)
            } catch (err) {
                console.error('[MermaidRenderer] 渲染失败:', err)
                setError(err instanceof Error ? err.message : '图表渲染失败')
            } finally {
                setIsRendering(false)
            }
        }

        renderDiagram()
    }, [code])

    if (isRendering) {
        return (
            <div className={`flex items-center justify-center py-8 ${className}`}>
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                <span className="ml-2 text-sm text-muted-foreground">正在渲染图谱...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className={`p-4 rounded-xl bg-destructive/5 border border-destructive/20 ${className}`}>
                <div className="text-sm text-destructive mb-2">图表渲染失败</div>
                <pre className="text-xs text-muted-foreground overflow-x-auto">{error}</pre>
                <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                        查看原始代码
                    </summary>
                    <pre className="mt-1 p-2 bg-muted/20 rounded text-xs overflow-x-auto">
                        {code}
                    </pre>
                </details>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className={`mermaid-container overflow-x-auto ${className}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    )
}
