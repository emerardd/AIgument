import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettingsStore, type Provider } from '@/stores/settingsStore'
import { useToast } from '@/hooks/useToast'
import { modelPresets } from '@/config/modelPresets'
import { settingsAPI, type ProviderInfo, type ProviderTestResponse } from '@/services/api'
import {
    AlertCircle,
    Check,
    CheckCircle2,
    Cpu,
    KeyRound,
    Loader2,
    Moon,
    RefreshCw,
    Server,
    Sliders,
    Sun,
    Wifi,
    WifiOff,
    Zap,
} from 'lucide-react'

const providerFallbacks: ProviderInfo[] = (Object.keys(modelPresets) as Provider[]).map((provider) => ({
    id: provider,
    label: provider === 'mock' ? 'Mock' : provider[0].toUpperCase() + provider.slice(1),
    description: provider === 'mock' ? '离线演示和功能测试' : '等待后端状态同步',
    models: modelPresets[provider],
    default_model: modelPresets[provider][0],
    configured: provider === 'mock',
    api_key_env: provider === 'mock' ? null : `${provider.toUpperCase()}_API_KEY`,
    can_manage_key: provider !== 'mock',
}))

type TestState = Record<string, { loading: boolean; result?: ProviderTestResponse }>

function isProvider(value: string): value is Provider {
    return value in modelPresets
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
    const toast = useToast()

    const [providers, setProviders] = useState<ProviderInfo[]>(providerFallbacks)
    const [isLoadingProviders, setIsLoadingProviders] = useState(true)
    const [pendingKeys, setPendingKeys] = useState<Record<string, string>>({})
    const [savingProvider, setSavingProvider] = useState<string | null>(null)
    const [testState, setTestState] = useState<TestState>({})

    const selectedProviderInfo = useMemo(
        () => providers.find((provider) => provider.id === defaultProvider),
        [providers, defaultProvider]
    )
    const selectedModels = selectedProviderInfo?.models?.length
        ? selectedProviderInfo.models
        : modelPresets[defaultProvider]

    const fetchProviders = async () => {
        setIsLoadingProviders(true)
        try {
            const response = await settingsAPI.getProviders()
            setProviders(response.data.providers)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '无法加载模型状态')
            setProviders(providerFallbacks)
        } finally {
            setIsLoadingProviders(false)
        }
    }

    useEffect(() => {
        fetchProviders()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleProviderSelect = (providerId: string) => {
        if (!isProvider(providerId)) return
        setDefaultProvider(providerId)
    }

    const handleSaveKey = async (provider: ProviderInfo) => {
        const apiKey = pendingKeys[provider.id] || ''
        setSavingProvider(provider.id)
        try {
            await settingsAPI.saveProviderKey(provider.id, apiKey)
            setPendingKeys((state) => ({ ...state, [provider.id]: '' }))
            await fetchProviders()
            toast.success(apiKey.trim() ? `${provider.label} API Key 已保存` : `${provider.label} API Key 已清除`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '保存失败')
        } finally {
            setSavingProvider(null)
        }
    }

    const handleTestProvider = async (provider: ProviderInfo) => {
        const model = provider.id === defaultProvider ? defaultModel : provider.default_model
        setTestState((state) => ({ ...state, [provider.id]: { loading: true } }))
        try {
            const response = await settingsAPI.testProvider(provider.id, model, pendingKeys[provider.id])
            setTestState((state) => ({ ...state, [provider.id]: { loading: false, result: response.data } }))
            if (response.data.ok) {
                toast.success(`${provider.label} 连接成功`)
            } else {
                toast.error(`${provider.label} 连接失败`)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '连接测试失败'
            setTestState((state) => ({
                ...state,
                [provider.id]: {
                    loading: false,
                    result: { provider: provider.id, model, ok: false, message },
                },
            }))
            toast.error(message)
        }
    }

    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-14 max-w-5xl">
                <div className="mb-8 sm:mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 animate-scale-in">
                        <Sliders className="w-4 h-4" />
                        <span>设置与模型可用性</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                        连接状态、默认模型与运行偏好
                    </h1>
                    <p className="text-muted-foreground max-w-2xl">
                        管理本机 API Key，测试模型是否可用，并设置基础对话与问答的输出方式。
                    </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="space-y-5">
                        <Card className="glass shadow-soft border-0">
                            <CardContent className="p-5 sm:p-6">
                                <div className="flex items-center justify-between gap-4 mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                                            <Server className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-foreground">AI 服务提供商</h2>
                                            <p className="text-sm text-muted-foreground">保存后只返回可用状态，不回显密钥</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchProviders}
                                        disabled={isLoadingProviders}
                                        className="rounded-xl"
                                    >
                                        {isLoadingProviders ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>

                                <div className="grid gap-4">
                                    {providers.map((provider) => {
                                        const isSelected = provider.id === defaultProvider
                                        const keyValue = pendingKeys[provider.id] || ''
                                        const test = testState[provider.id]

                                        return (
                                            <div
                                                key={provider.id}
                                                className={`rounded-xl border p-4 transition-colors ${
                                                    isSelected
                                                        ? 'border-primary/40 bg-primary/5'
                                                        : 'border-border/70 bg-background/50'
                                                }`}
                                            >
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleProviderSelect(provider.id)}
                                                        className="text-left flex-1 min-w-0"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                            <span className="font-semibold">{provider.label}</span>
                                                            {provider.configured ? (
                                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    可用
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    未配置
                                                                </span>
                                                            )}
                                                            {isSelected && (
                                                                <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                                    <Check className="w-3 h-3" />
                                                                    默认
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{provider.description}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {provider.models.join(' / ')}
                                                        </p>
                                                    </button>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleTestProvider(provider)}
                                                        disabled={test?.loading}
                                                        className="rounded-xl shrink-0"
                                                    >
                                                        {test?.loading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : provider.configured || keyValue ? (
                                                            <Wifi className="w-4 h-4" />
                                                        ) : (
                                                            <WifiOff className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </div>

                                                {provider.can_manage_key && (
                                                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                                        <div className="relative flex-1">
                                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input
                                                                type="password"
                                                                value={keyValue}
                                                                onChange={(event) =>
                                                                    setPendingKeys((state) => ({
                                                                        ...state,
                                                                        [provider.id]: event.target.value,
                                                                    }))
                                                                }
                                                                placeholder={
                                                                    provider.configured
                                                                        ? `${provider.api_key_env} 已配置，输入新值可替换`
                                                                        : `输入 ${provider.api_key_env || 'API Key'}`
                                                                }
                                                                className="pl-9 rounded-xl"
                                                            />
                                                        </div>
                                                        <Button
                                                            onClick={() => handleSaveKey(provider)}
                                                            disabled={savingProvider === provider.id}
                                                            className="rounded-xl"
                                                        >
                                                            {savingProvider === provider.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : keyValue.trim() ? (
                                                                '保存'
                                                            ) : (
                                                                '清除'
                                                            )}
                                                        </Button>
                                                    </div>
                                                )}

                                                {test?.result && (
                                                    <div
                                                        className={`mt-3 text-xs rounded-lg px-3 py-2 ${
                                                            test.result.ok
                                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                                : 'bg-destructive/10 text-destructive'
                                                        }`}
                                                    >
                                                        {test.result.ok ? '连接成功' : '连接失败'}：
                                                        {test.result.message}
                                                        {typeof test.result.latency_ms === 'number'
                                                            ? ` (${test.result.latency_ms}ms)`
                                                            : ''}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-5">
                        <Card className="glass shadow-soft border-0">
                            <CardContent className="p-5 sm:p-6 space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                                        <Cpu className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold">默认模型</h2>
                                        <p className="text-sm text-muted-foreground">新会话默认使用这组配置</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {selectedModels.map((model) => (
                                        <button
                                            key={model}
                                            onClick={() => setDefaultModel(model)}
                                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                                                defaultModel === model
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                        >
                                            {model}
                                        </button>
                                    ))}
                                </div>

                                <Input
                                    value={defaultModel}
                                    onChange={(event) => setDefaultModel(event.target.value)}
                                    placeholder="或输入自定义模型名称..."
                                    className="rounded-xl"
                                />

                                {!selectedProviderInfo?.configured && defaultProvider !== 'mock' && (
                                    <div className="text-xs rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2">
                                        当前默认 provider 尚未配置 API Key，真实调用会失败。可先使用 Mock 离线演示。
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="glass shadow-soft border-0">
                            <CardContent className="p-5 sm:p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                                            {darkMode ? (
                                                <Moon className="w-5 h-5 text-primary" />
                                            ) : (
                                                <Sun className="w-5 h-5 text-primary" />
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="font-semibold">外观模式</h2>
                                            <p className="text-sm text-muted-foreground">
                                                当前为{darkMode ? '深色' : '浅色'}模式
                                            </p>
                                        </div>
                                    </div>
                                    <Button onClick={toggleDarkMode} variant="outline" className="rounded-xl">
                                        切换
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="glass shadow-soft border-0">
                            <CardContent className="p-5 sm:p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold">基础对话/问答输出</h2>
                                            <p className="text-sm text-muted-foreground">
                                                {streamMode ? '实时显示普通对话和传统问答' : '等待完整回复后显示'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Agent 辩论、角色对话和辩证法引擎始终使用事件流。
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setStreamMode(!streamMode)}
                                        className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${
                                            streamMode ? 'bg-primary' : 'bg-muted'
                                        }`}
                                        title="切换基础对话和问答输出方式"
                                    >
                                        <span
                                            className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-soft transition-all ${
                                                streamMode ? 'left-7' : 'left-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-muted/30 border-0">
                            <CardContent className="p-4 text-sm text-muted-foreground">
                                当前配置：
                                <span className="font-medium text-foreground"> {defaultProvider}</span> /
                                <span className="font-medium text-foreground"> {defaultModel}</span> /
                                <span className="font-medium text-foreground"> {streamMode ? '流式' : '非流式'}</span>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
