/**
 * 辩论导出工具
 * 将辩论数据导出为格式化的 Markdown 文档
 */
import type { RoundEvaluation, FinalVerdict } from '@/types'
import type { AgentDebateMessage } from '@/stores/agentDebateStore'

interface ExportData {
    topic: string
    messages: AgentDebateMessage[]
    evaluations: RoundEvaluation[]
    verdict: FinalVerdict | null
    totalRounds: number
}

/**
 * 将辩论数据导出为 Markdown 字符串
 */
export function generateDebateMarkdown(data: ExportData): string {
    const { topic, messages, evaluations, verdict, totalRounds } = data
    const lines: string[] = []

    lines.push(`# 🎙️ AI 辩论记录`)
    lines.push('')
    lines.push(`> **辩题**: ${topic}`)
    lines.push(`> **轮次**: ${totalRounds} 轮`)
    lines.push(`> **导出时间**: ${new Date().toLocaleString('zh-CN')}`)
    lines.push('')
    lines.push('---')
    lines.push('')

    // 按轮次组织
    for (let round = 1; round <= totalRounds; round++) {
        const roundMessages = messages.filter(m => m.round === round)
        const evaluation = evaluations.find(e => e.round === round)

        lines.push(`## 第 ${round} 轮`)
        lines.push('')

        for (const msg of roundMessages) {
            const icon = msg.role === '正方' ? '🟦' : '🟧'
            lines.push(`### ${icon} ${msg.role}`)
            lines.push('')
            lines.push(msg.content)
            lines.push('')
        }

        if (evaluation) {
            lines.push(`### 📊 评审评分`)
            lines.push('')
            lines.push(`| 维度 | 正方 | 反方 |`)
            lines.push(`|------|------|------|`)
            lines.push(`| 逻辑 | ${evaluation.pro_score.logic} | ${evaluation.con_score.logic} |`)
            lines.push(`| 证据 | ${evaluation.pro_score.evidence} | ${evaluation.con_score.evidence} |`)
            lines.push(`| 修辞 | ${evaluation.pro_score.rhetoric} | ${evaluation.con_score.rhetoric} |`)
            lines.push(`| 反驳 | ${evaluation.pro_score.rebuttal} | ${evaluation.con_score.rebuttal} |`)
            lines.push('')

            const winnerLabel = evaluation.round_winner === 'pro' ? '正方胜' :
                evaluation.round_winner === 'con' ? '反方胜' : '平局'
            lines.push(`**本轮结果**: ${winnerLabel}`)
            lines.push('')

            if (evaluation.commentary) {
                lines.push(`**评审点评**: ${evaluation.commentary}`)
                lines.push('')
            }
        }

        lines.push('---')
        lines.push('')
    }

    // 最终裁决
    if (verdict) {
        lines.push('## 🏆 最终裁决')
        lines.push('')

        const winnerIcon = verdict.winner === 'pro' ? '🟦 正方获胜' :
            verdict.winner === 'con' ? '🟧 反方获胜' : '⚖️ 平局'
        lines.push(`### ${winnerIcon}`)
        lines.push('')
        lines.push(`- **正方总分**: ${verdict.pro_total_score}`)
        lines.push(`- **反方总分**: ${verdict.con_total_score}`)
        lines.push(`- **胜负差距**: ${verdict.margin === 'decisive' ? '压倒性' : verdict.margin === 'close' ? '势均力敌' : '微弱优势'}`)
        lines.push('')

        if (verdict.summary) {
            lines.push(`**总结**: ${verdict.summary}`)
            lines.push('')
        }

        if (verdict.pro_strengths.length > 0) {
            lines.push(`**正方亮点**:`)
            verdict.pro_strengths.forEach(s => lines.push(`- ${s}`))
            lines.push('')
        }

        if (verdict.con_strengths.length > 0) {
            lines.push(`**反方亮点**:`)
            verdict.con_strengths.forEach(s => lines.push(`- ${s}`))
            lines.push('')
        }

        if (verdict.key_turning_points.length > 0) {
            lines.push(`**关键转折**:`)
            verdict.key_turning_points.forEach(s => lines.push(`- ${s}`))
            lines.push('')
        }
    }

    lines.push('---')
    lines.push('')
    lines.push('*由 AIgument 自动生成*')

    return lines.join('\n')
}

/**
 * 下载 Markdown 文件
 */
export function downloadMarkdown(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/**
 * 一键导出辩论
 */
export function exportDebateMarkdown(data: ExportData): void {
    const md = generateDebateMarkdown(data)
    const safeTopic = data.topic.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_').slice(0, 30)
    const filename = `辩论_${safeTopic}_${new Date().toISOString().slice(0, 10)}.md`
    downloadMarkdown(md, filename)
}
