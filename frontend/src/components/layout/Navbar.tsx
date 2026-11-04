import { NavLink } from 'react-router-dom'
import { History, Lightbulb, Moon, Settings, Sun, Swords, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

interface NavItem {
    path: string
    label: string
    icon: LucideIcon
}

const MODES: NavItem[] = [
    { path: '/debate', label: '辩论', icon: Swords },
    { path: '/dual-chat', label: '对话', icon: Users },
    { path: '/socratic-qa', label: '问答', icon: Lightbulb },
]

const TOOLS: NavItem[] = [
    { path: '/history', label: '历史', icon: History },
    { path: '/settings', label: '设置', icon: Settings },
]

/** The mark: two stones on one line, the app's whole idea in 28px. */
function Mark() {
    return (
        <svg viewBox="0 0 28 28" className="w-7 h-7" aria-hidden="true">
            <line x1="3" y1="14" x2="25" y2="14" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8.5" cy="14" r="5" fill="var(--pro)" />
            <circle cx="19.5" cy="14" r="5" fill="var(--con)" />
        </svg>
    )
}

function RailLink({ path, label, icon: Icon }: NavItem) {
    return (
        <NavLink
            to={path}
            className={({ isActive }) =>
                `group relative flex flex-col items-center justify-center gap-0.5 md:gap-1 rounded-md w-12 py-1.5 md:w-14 md:py-2.5 text-[0.6875rem] md:text-[0.75rem] transition-colors ${isActive
                    ? 'text-ink bg-sunken'
                    : 'text-ink-3 hover:text-ink'}`
            }
        >
            {({ isActive }) => (
                <>
                    {isActive && <span className="hidden md:block absolute -left-2 top-2 bottom-2 w-[3px] rounded-full bg-ink" />}
                    <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    <span>{label}</span>
                </>
            )}
        </NavLink>
    )
}

/** Desktop: a narrow rail on the left. Phone: one bar along the top. */
export function Navbar() {
    const { darkMode, toggleDarkMode } = useSettingsStore()

    return (
        <nav
            aria-label="主导航"
            className="sticky top-0 z-40 bg-board border-b md:border-b-0 md:border-r border-line md:h-screen md:w-[76px] shrink-0 flex md:flex-col items-center gap-1 px-3 md:px-0 md:py-4"
        >
            <NavLink to="/" className="text-ink-3 hover:text-ink md:mb-5 mr-2 md:mr-0 p-1" aria-label="AIgument 首页" title="首页">
                <Mark />
            </NavLink>

            <div className="flex md:flex-col gap-1">
                {MODES.map(item => <RailLink key={item.path} {...item} />)}
            </div>

            <div className="ml-auto md:ml-0 md:mt-auto flex md:flex-col items-center gap-1">
                {TOOLS.map(item => <RailLink key={item.path} {...item} />)}
                <button
                    onClick={toggleDarkMode}
                    className="flex items-center justify-center w-9 h-9 md:w-14 md:h-10 rounded-md text-ink-3 hover:text-ink"
                    aria-label={darkMode ? '切换到浅色' : '切换到深色'}
                    title={darkMode ? '切换到浅色' : '切换到深色'}
                >
                    {darkMode ? <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />}
                </button>
            </div>
        </nav>
    )
}
