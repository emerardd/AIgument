import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
    content: string
    className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                    h2: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>,
                    h3: ({ children }) => <h4 className="text-[0.95rem] font-semibold mt-3 mb-1.5">{children}</h4>,
                    p: ({ children }) => <p className="leading-[1.85]">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-ink-3">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-ink-3">{children}</ol>,
                    li: ({ children }) => <li className="pl-1">{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-line-strong pl-4 my-3 text-ink-2">{children}</blockquote>
                    ),
                    code: ({ children, className: codeClass }) =>
                        codeClass
                            ? <code className="block bg-sunken p-3 rounded-md overflow-x-auto text-[0.8125rem] font-mono">{children}</code>
                            : <code>{children}</code>,
                    pre: ({ children }) => <pre className="my-3">{children}</pre>,
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                            <table className="min-w-full border-collapse text-sm">{children}</table>
                        </div>
                    ),
                    th: ({ children }) => <th className="border-b border-line-strong px-3 py-2 text-left font-semibold">{children}</th>,
                    td: ({ children }) => <td className="border-b border-line px-3 py-2">{children}</td>,
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-pro underline underline-offset-2">
                            {children}
                        </a>
                    ),
                    hr: () => <hr className="my-4 border-line" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
