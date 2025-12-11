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
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold mt-4 mb-3 text-gray-900 dark:text-gray-100">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold mt-2 mb-1 text-gray-800 dark:text-gray-200">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
                    ),
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-400 pl-4 py-2 my-3 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 rounded-r">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children, className }) => {
                        const isInline = !className
                        if (isInline) {
                            return (
                                <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-pink-600 dark:text-pink-400">
                                    {children}
                                </code>
                            )
                        }
                        return (
                            <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-sm font-mono">
                                {children}
                            </code>
                        )
                    },
                    pre: ({ children }) => (
                        <pre className="my-3 rounded-lg overflow-hidden">{children}</pre>
                    ),
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                            <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
                                {children}
                            </table>
                        </div>
                    ),
                    th: ({ children }) => (
                        <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">
                            {children}
                        </td>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-bold text-gray-900 dark:text-gray-100">
                            {children}
                        </strong>
                    ),
                    em: ({ children }) => <em className="italic">{children}</em>,
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                            {children}
                        </a>
                    ),
                    hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
