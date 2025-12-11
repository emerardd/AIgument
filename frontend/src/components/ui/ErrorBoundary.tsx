import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './button'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: React.ErrorInfo | null
}

/**
 * 错误边界组件
 * 捕获子组件中的 JavaScript 错误，并显示备用 UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo)
        this.setState({ errorInfo })
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }

    handleGoHome = () => {
        window.location.href = '/'
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="text-center max-w-md space-y-6 animate-fade-in">
                        {/* Icon */}
                        <div className="w-20 h-20 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-10 h-10 text-destructive" />
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold text-foreground">出错了</h2>
                            <p className="text-muted-foreground text-sm">
                                抱歉，页面遇到了一些问题。请尝试刷新或返回首页。
                            </p>
                        </div>

                        {/* Error Details (Development) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="p-4 rounded-xl bg-muted/50 text-left overflow-auto max-h-32">
                                <p className="text-xs font-mono text-destructive">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-center">
                            <Button
                                variant="outline"
                                onClick={this.handleGoHome}
                                className="gap-2"
                            >
                                <Home className="w-4 h-4" />
                                返回首页
                            </Button>
                            <Button
                                onClick={this.handleReset}
                                className="gap-2 btn-primary"
                            >
                                <RefreshCw className="w-4 h-4" />
                                重试
                            </Button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
