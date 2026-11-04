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

    // The SVG is inlined into the page, so themeCSS can use the board tokens and follow dark mode.
    mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'strict',
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        themeVariables: {
            primaryColor: '#f7f8f5',
            primaryTextColor: '#18201d',
            primaryBorderColor: '#a9b3ac',
            lineColor: '#737d79',
            background: 'transparent',
            mainBkg: 'transparent',
            fontSize: '14px',
        },
        flowchart: {
            curve: 'basis',
            padding: 16,
            nodeSpacing: 50,
            rankSpacing: 70,
            htmlLabels: true,
            useMaxWidth: true,
        },
        themeCSS: `
            .node rect, .node circle, .node ellipse, .node polygon {
                fill: var(--surface) !important;
                stroke: var(--line-strong) !important;
                stroke-width: 1px !important;
            }
            .node.pro rect, .node.pro circle, .node.pro polygon { stroke: var(--pro) !important; stroke-width: 2px !important; }
            .node.con rect, .node.con circle, .node.con polygon { stroke: var(--con) !important; stroke-width: 2px !important; }
            .edgePath path, .flowchart-link { stroke: var(--ink-3) !important; stroke-width: 1.5px !important; }
            marker path { fill: var(--ink-3) !important; stroke: var(--ink-3) !important; }
            .edgeLabel, .edgeLabel p { background-color: var(--board) !important; color: var(--ink-2) !important; font-size: 12px !important; }
            .label, .nodeLabel, .nodeLabel p { color: var(--ink) !important; fill: var(--ink) !important; }
        `,
    })
    initialized = true
}

export function MermaidRenderer({ code, className = '' }: MermaidRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [isRendering, setIsRendering] = useState(true)

    useEffect(() => {
        if (!code) {
            setIsRendering(false)
            return
        }

        const renderDiagram = async () => {
            setIsRendering(true)
            setError(null)

            // 确保 Mermaid 已初始化
            if (!initialized) {
                initMermaid()
            }

            try {
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                // 这是一个异步过程
                const { svg: renderedSvg } = await mermaid.render(id, code)
                setSvg(renderedSvg)
            } catch (err) {
                console.error('[MermaidRenderer] Render failed:', err)
                setError(err instanceof Error ? err.message : 'Unknown CSS parsing error')

                // 发生错误时，如果不重置，Mermaid 可能会卡在错误状态
                // 这里我们可以尝试简单的错误恢复，比如重新显示代码
            } finally {
                setIsRendering(false)
            }
        }

        // 使用 unmount 清理或防抖通常在 mermaid 中不需要，但要注意异步竞态
        let mounted = true
        renderDiagram().then(() => {
            if (!mounted) return
        })

        return () => {
            mounted = false
        }
    }, [code])

    if (error) {
        return (
            <div className={`text-sm ${className}`} role="alert">
                <p className="text-ink-2">关系图没能画出来，下面的代码仍然可以复制使用。</p>
                <pre className="mt-2 text-[0.75rem] text-ink-3 overflow-x-auto bg-sunken p-2 rounded">{error}</pre>
            </div>
        )
    }

    return (
        <div className={`relative ${className}`}>
            {isRendering && <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-3">正在绘制…</p>}
            <div
                ref={containerRef}
                className={`overflow-x-auto ${isRendering ? 'invisible' : ''}`}
                dangerouslySetInnerHTML={{ __html: svg }}
            />
        </div>
    )
}
