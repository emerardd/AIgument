import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Page } from '@/components/layout/Page'
import { useSettingsStore, type Provider } from '@/stores/settingsStore'
import { useToast } from '@/hooks/useToast'
import { modelPresets } from '@/config/modelPresets'
import { settingsAPI, type ProviderInfo, type ProviderTestResponse } from '@/services/api'

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
        toggleDarkMode,
        setDefaultProvider,
        setDefaultModel,
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
            toast.success(apiKey.trim() ? `${provider.label} 密钥已保存` : `${provider.label} 密钥已清除`)
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
                toast.success(`${provider.label} 连接正常`)
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

    const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
        <section className="grid md:grid-cols-[13rem_1fr] gap-x-10 gap-y-4 py-8 border-t border-line">
            <div>
                <h2 className="text-lg">{title}</h2>
                {note && <p className="text-[0.8125rem] text-ink-3 mt-1 leading-relaxed">{note}</p>}
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    )

    return (
        <Page title="设置" description="密钥只保存在这台电脑上，保存后页面不会再显示它。">
            {Section({
                title: '默认模型',
                note: '新开的辩论、对话和问答都用这个模型。对抗辩论里可以给双方单独指定。',
                children: (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={defaultProvider}
                                onChange={(e) => handleProviderSelect(e.target.value)}
                                className="field h-10 px-3"
                                aria-label="默认服务商"
                            >
                                {providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedModels.map((model) => (
                                    <button key={model} type="button" className="chip" aria-pressed={defaultModel === model} onClick={() => setDefaultModel(model)}>
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="max-w-sm">
                            <label htmlFor="custom-model" className="block text-[0.8125rem] text-ink-3 mb-1.5">或者填写模型名称</label>
                            <Input id="custom-model" value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} />
                        </div>
                        {!selectedProviderInfo?.configured && defaultProvider !== 'mock' && (
                            <p className="text-sm border-l-2 border-jury pl-3 text-ink-2">
                                {selectedProviderInfo?.label ?? defaultProvider} 还没有密钥，调用会失败。先在下面填好密钥，或者改用 Mock 试用。
                            </p>
                        )}
                    </div>
                ),
            })}

            {Section({
                title: '服务商与密钥',
                note: '测试会用该服务商的默认模型发一条很短的请求。',
                children: (
                    <div>
                        <div className="flex justify-end mb-2">
                            <button type="button" onClick={fetchProviders} disabled={isLoadingProviders} className="btn-line h-8 text-[0.8125rem]">
                                {isLoadingProviders ? '刷新中…' : '刷新状态'}
                            </button>
                        </div>
                        <ul className="border-t border-line">
                            {providers.map((provider) => {
                                const keyValue = pendingKeys[provider.id] || ''
                                const test = testState[provider.id]
                                return (
                                    <li key={provider.id} className="py-4 border-b border-line">
                                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                            <span className="font-medium">{provider.label}</span>
                                            <span className={`text-[0.8125rem] ${provider.configured ? 'text-ink-2' : 'text-jury'}`}>
                                                {provider.configured ? '已就绪' : '缺少密钥'}
                                            </span>
                                            {provider.id === defaultProvider && <span className="text-[0.8125rem] text-ink-3">当前默认</span>}
                                            <button
                                                type="button"
                                                onClick={() => handleTestProvider(provider)}
                                                disabled={test?.loading}
                                                className="ml-auto btn-line h-8 text-[0.8125rem]"
                                            >
                                                {test?.loading ? '测试中…' : '测试连接'}
                                            </button>
                                        </div>
                                        <p className="text-[0.8125rem] text-ink-3 mt-0.5">{provider.description}</p>

                                        {provider.can_manage_key && (
                                            <form
                                                className="mt-3 flex flex-col sm:flex-row gap-2"
                                                onSubmit={(e) => { e.preventDefault(); handleSaveKey(provider) }}
                                            >
                                                <Input
                                                    type="password"
                                                    autoComplete="off"
                                                    value={keyValue}
                                                    aria-label={`${provider.label} 密钥`}
                                                    onChange={(event) => setPendingKeys((state) => ({ ...state, [provider.id]: event.target.value }))}
                                                    placeholder={provider.configured ? '已保存，输入新的密钥可替换' : `填写 ${provider.api_key_env || 'API Key'}`}
                                                />
                                                {keyValue.trim() || !provider.configured ? (
                                                    <button type="submit" disabled={savingProvider === provider.id || !keyValue.trim()} className="btn-ink shrink-0">
                                                        {savingProvider === provider.id ? '保存中…' : '保存密钥'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={savingProvider === provider.id}
                                                        onClick={() => { if (confirm(`清除 ${provider.label} 的密钥？之后调用它会失败。`)) handleSaveKey(provider) }}
                                                        className="btn-line h-10 shrink-0"
                                                    >
                                                        {savingProvider === provider.id ? '清除中…' : '清除密钥'}
                                                    </button>
                                                )}
                                            </form>
                                        )}

                                        {test?.result && (
                                            <p className={`mt-2 text-[0.8125rem] ${test.result.ok ? 'text-ink-2' : 'text-destructive'}`} role="status">
                                                {test.result.ok ? '连接正常' : '连接失败'}：{test.result.message}
                                                {typeof test.result.latency_ms === 'number' ? `（${test.result.latency_ms} ms）` : ''}
                                            </p>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ),
            })}

            {Section({
                title: '外观',
                children: (
                    <div className="segmented" role="group" aria-label="外观">
                        <button type="button" aria-pressed={!darkMode} onClick={() => darkMode && toggleDarkMode()}>浅色</button>
                        <button type="button" aria-pressed={darkMode} onClick={() => !darkMode && toggleDarkMode()}>深色</button>
                    </div>
                ),
            })}
        </Page>
    )
}
