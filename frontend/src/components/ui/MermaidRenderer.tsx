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

    // 获取当前的主题色（这里硬编码为 index.css 中的深蓝主题色，以防 CSS 变量在 SVG 中未解析）
    // 注意：Mermaid 的 SVG 隔离性较好，直接用 CSS 变量有时会失效，尤其是线条颜色
    const colors = {
        primary: '#3b82f6', // blue-500
        secondary: '#0ea5e9', // sky-500
        background: '#0f172a', // slate-900 (Deep Navy)
        surface: '#1e293b', // slate-800
        border: '#334155', // slate-700
        text: '#f8fafc', // slate-50
        textMuted: '#94a3b8', // slate-400
        line: '#475569', // slate-600
    }

    mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        fontFamily: 'Inter, system-ui, sans-serif',
        themeVariables: {
            primaryColor: colors.primary,
            primaryTextColor: colors.text,
            primaryBorderColor: colors.primary,
            lineColor: colors.line,
            secondaryColor: colors.secondary,
            tertiaryColor: colors.surface,
            mainBkg: 'transparent', // 透明背景让卡片背景透出来
            nodeBkg: 'transparent', // 节点透明，通过 CSS 加玻璃态
            background: 'transparent',

            // 字体配置
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',

            // 连线和箭头
            arrowheadColor: colors.textMuted,
        },
        flowchart: {
            curve: 'basis', // 优雅的曲线
            padding: 20,
            nodeSpacing: 60,
            rankSpacing: 80,
            htmlLabels: true,
            useMaxWidth: true,
        },
        themeCSS: `
            /* 节点通用样式 - 玻璃态卡片 */
            .node rect, .node circle, .node ellipse, .node polygon {
                fill: rgba(30, 41, 59, 0.7) !important; /* slate-800 / 0.7 */
                stroke: #3b82f6 !important;
                stroke-width: 1.5px !important;
                filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
            }

            /* 正方观点 (Pro) - 蓝色系 */
            .node.pro rect, .node.pro circle, .node.pro polygon {
                fill: rgba(59, 130, 246, 0.15) !important;
                stroke: #3b82f6 !important;
            }
            .node.pro .label { color: #bfdbfe !important; }

            /* 反方观点 (Con) - 橙/红色系 -> 改为青色/紫色系以匹配深蓝主题，或者保持对比色但更高级 */
            /* 这里使用 Deep Orange 作为强对比，但降低饱和度 */
            .node.con rect, .node.con circle, .node.con polygon {
                fill: rgba(249, 115, 22, 0.15) !important;
                stroke: #f97316 !important;
            }
            
            /* 连线样式 */
            .edgePath path {
                stroke: #475569 !important; /* slate-600 */
                stroke-width: 2px !important;
                opacity: 0.6;
                transition: opacity 0.3s;
            }
            .edgePath path:hover {
                opacity: 1;
                stroke: #94a3b8 !important;
            }

            /* 连线标签 */
            .edgeLabel {
                background-color: #0f172a !important; /* slate-900 */
                color: #94a3b8 !important;
                padding: 4px 8px !important;
                border-radius: 6px !important;
                font-size: 11px !important;
                border: 1px solid #334155 !important;
            }

            /* 节点文字 */
            .label {
                font-family: 'Inter', system-ui, sans-serif !important;
                font-weight: 500 !important;
                color: #f8fafc !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
        `
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
            <div className={`p-4 rounded-xl bg-red-950/30 border border-red-900/50 ${className}`}>
                <div className="flex items-center gap-2 text-red-400 mb-2 font-medium text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    图表渲染失败
                </div>
                <pre className="text-xs text-slate-400 overflow-x-auto font-mono bg-black/20 p-2 rounded">{error}</pre>
            </div>
        )
    }

    return (
        <div
            className={`mermaid-wrapper group relative overflow-hidden rounded-xl bg-slate-900/40 border border-slate-700/50 backdrop-blur-sm transition-all duration-500 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 ${className}`}
        >
            {/* 加载状态 */}
            {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px] z-10">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* 渲染内容 */}
            <div
                ref={containerRef}
                className={`p-6 overflow-x-auto transition-opacity duration-500 ${isRendering ? 'opacity-0' : 'opacity-100'}`}
                dangerouslySetInnerHTML={{ __html: svg }}
            />

            {/* 装饰性光晕 */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/15 transition-colors duration-500" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/15 transition-colors duration-500" />
        </div>
    )
}
