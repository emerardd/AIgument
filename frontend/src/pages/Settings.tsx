import { useSettingsStore } from '@/stores/settingsStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, Cpu, Zap, Server, Check, Moon, Sun } from 'lucide-react'

const providerOptions = [
    { value: 'deepseek' as const, label: 'DeepSeek', description: '高性价比，中文能力强' },
    { value: 'openai' as const, label: 'OpenAI', description: 'GPT 系列模型' },
]

const modelPresets = {
    deepseek: ['deepseek-chat', 'deepseek-coder'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
}

export default function SettingsPage() {
    const {
        darkMode,
        defaultProvider,
        defaultModel,
        streamMode,
        toggleDarkMode,
        setDefaultProvider,
        setDefaultModel,
        setStreamMode,
    } = useSettingsStore()

    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-6 py-10 max-w-3xl">
                {/* Header */}
                <div className="text-center mb-10 animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                        <Settings className="w-4 h-4" />
                        <span>应用设置</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                        <span className="text-gradient">偏好设置</span>
                    </h1>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                        自定义 AI 模型、外观和其他选项
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Theme Setting */}
                    <Card className="glass shadow-soft border-0 overflow-hidden animate-fade-in">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-soft">
                                        {darkMode ? <Moon className="w-6 h-6 text-white" /> : <Sun className="w-6 h-6 text-white" />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">外观模式</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {darkMode ? '当前为深色模式' : '当前为浅色模式'}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={toggleDarkMode}
                                    variant="outline"
                                    className="rounded-xl"
                                >
                                    切换为{darkMode ? '浅色' : '深色'}模式
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Provider Selection */}
                    <Card className="glass shadow-soft border-0 overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-soft">
                                    <Server className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">AI 服务提供商</h3>
                                    <p className="text-sm text-muted-foreground">选择要使用的 AI 服务</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {providerOptions.map((option) => {
                                    const isSelected = defaultProvider === option.value
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setDefaultProvider(option.value)
                                                // 切换 provider 时设置默认模型
                                                setDefaultModel(modelPresets[option.value][0])
                                            }}
                                            className={`
                                                relative p-5 rounded-2xl text-left transition-all duration-300
                                                ${isSelected
                                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-soft-lg'
                                                    : 'bg-muted/50 hover:bg-muted text-foreground hover:shadow-soft'
                                                }
                                            `}
                                        >
                                            <div className="font-semibold mb-1">{option.label}</div>
                                            <div className={`text-sm ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                                                {option.description}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                                    <Check className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Model Selection */}
                    <Card className="glass shadow-soft border-0 overflow-hidden animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-soft">
                                    <Cpu className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">AI 模型</h3>
                                    <p className="text-sm text-muted-foreground">选择或输入模型名称</p>
                                </div>
                            </div>

                            {/* Preset Models */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {modelPresets[defaultProvider].map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => setDefaultModel(model)}
                                        className={`
                                            px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                                            ${defaultModel === model
                                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-soft'
                                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }
                                        `}
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Model Input */}
                            <div className="flex gap-3">
                                <Input
                                    placeholder="或输入自定义模型名称..."
                                    value={defaultModel}
                                    onChange={(e) => setDefaultModel(e.target.value)}
                                    className="flex-1 rounded-xl border-0 bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stream Mode */}
                    <Card className="glass shadow-soft border-0 overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-soft">
                                        <Zap className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">流式输出</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {streamMode ? '实时显示 AI 回复' : '等待完整回复后显示'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setStreamMode(!streamMode)}
                                    className={`
                                        relative w-14 h-8 rounded-full transition-all duration-300
                                        ${streamMode
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                            : 'bg-muted'
                                        }
                                    `}
                                >
                                    <div
                                        className={`
                                            absolute top-1 w-6 h-6 rounded-full bg-white shadow-soft transition-all duration-300
                                            ${streamMode ? 'left-7' : 'left-1'}
                                        `}
                                    />
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Current Config Summary */}
                    <Card className="bg-muted/30 border-0 overflow-hidden animate-fade-in" style={{ animationDelay: '0.4s' }}>
                        <CardContent className="p-5">
                            <div className="text-sm text-muted-foreground text-center">
                                当前配置：<span className="font-medium text-foreground">{defaultProvider}</span> /
                                <span className="font-medium text-foreground"> {defaultModel}</span> /
                                <span className="font-medium text-foreground"> {streamMode ? '流式' : '非流式'}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
