import { Link } from 'react-router-dom'
import { Brain, Users, Lightbulb, History, ArrowRight, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ModeEntry {
    path: string
    title: string
    description: string
    points: string[]
    icon: LucideIcon
}

const modes: ModeEntry[] = [
    {
        path: '/debate',
        title: '辩论',
        description: '正反方 Agent 对抗辩论，或用正题—反题—合题推演观点。',
        points: ['可选不同模型对战', '逐轮评分与最终裁决', '论点图谱与观点进化树'],
        icon: Brain,
    },
    {
        path: '/dual-chat',
        title: '角色对话',
        description: '选择两个性格不同的角色，围绕主题展开多轮讨论。',
        points: ['多种预设角色', '实时流式输出'],
        icon: Users,
    },
    {
        path: '/socratic-qa',
        title: '问答',
        description: '引导式提问帮你自己想清楚，也可以直接要结构化答案。',
        points: ['苏格拉底 / 结构化 / 混合三种模式', '支持连续追问与从历史继续'],
        icon: Lightbulb,
    },
]

export default function Home() {
    return (
        <div className="min-h-screen gradient-bg">
            <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 max-w-5xl">
                <div className="text-center mb-10 sm:mb-12">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-scale-in">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>AI 辩论与思考工具</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 tracking-tight">
                        <span className="text-gradient">AIgument</span>
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        选择一种模式开始。所有会话都会保存在历史记录里，可随时查看和导出。
                    </p>
                </div>

                <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
                    {modes.map(({ path, title, description, points, icon: Icon }) => (
                        <Link
                            key={path}
                            to={path}
                            className="group glass shadow-soft rounded-2xl p-5 sm:p-6 flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                        >
                            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                                <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <h2 className="text-lg font-semibold mb-2">{title}</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
                            <ul className="text-sm text-muted-foreground space-y-1 mb-5 flex-1">
                                {points.map(point => (
                                    <li key={point} className="flex gap-2">
                                        <span className="text-primary">·</span>
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                开始
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </span>
                        </Link>
                    ))}
                </div>

                <div className="mt-8 text-center">
                    <Link
                        to="/history"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <History className="w-4 h-4" />
                        查看历史记录
                    </Link>
                </div>
            </div>
        </div>
    )
}
