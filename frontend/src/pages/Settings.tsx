import { useSettingsStore, type Provider } from '@/stores/settingsStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, Cpu, Zap, Server, Check, Moon, Sun, Sliders, Sparkles } from 'lucide-react'

const providerOptions: { value: Provider; label: string; description: string }[] = [
    { value: 'deepseek', label: 'DeepSeek', description: '高性价比，中文能力强' },
    { value: 'openai', label: 'OpenAI', description: 'GPT 系列模型' },
    { value: 'gemini', label: 'Google Gemini', description: 'Google 最新 AI 模型' },
    { value: 'claude', label: 'Anthropic Claude', description: '安全可靠的 AI 助手' },
]

const modelPresets: Record<Provider, string[]> = {
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    openai: ['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.2-pro', 'gpt-5', 'gpt-4.1'],
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'],
    claude: ['claude-opus-4.6', 'claude-sonnet-4.6'],
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
            {/* Hero Section */}
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16 max-w-3xl">
                <div className="text-center mb-8 sm:mb-12">
                    {/* Decorative Badge */}
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in">
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>应用设置</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight animate-slide-up delay-100 opacity-0">
                        <span className="text-gradient">偏好设置</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up delay-200 opacity-0 px-4 sm:px-0">
                        自定义 AI 模型、外观和其他选项
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6 sm:mt-8 animate-slide-up delay-300 opacity-0">
                        {[
                            { icon: Server, label: '多模型支持' },
                            { icon: Sliders, label: '个性化配置' },
                            { icon: Sparkles, label: '流式输出' },
                        ].map(({ icon: Icon, label }) => (
                            <div
                                key={label}
                                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl glass shadow-soft-sm text-xs sm:text-sm text-muted-foreground hover:scale-105 transition-transform duration-300"
                            >
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6 animate-elastic delay-500 opacity-0">
                    {/* Theme Setting */}
                    <Card className="glass shadow-soft border-0 overflow-hidden animate-fade-in">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                                        {darkMode ? <Moon className="w-6 h-6 text-primary" /> : <Sun className="w-6 h-6 text-primary" />}
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
                                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                                    <Server className="w-6 h-6 text-primary" />
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
                                                    ? 'bg-primary text-primary-foreground shadow-soft-lg'
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
                                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                                    <Cpu className="w-6 h-6 text-primary" />
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
                                                ? 'bg-primary text-primary-foreground shadow-soft'
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
                                    <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                                        <Zap className="w-6 h-6 text-primary" />
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
                                            ? 'bg-primary'
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
