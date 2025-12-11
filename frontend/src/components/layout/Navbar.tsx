import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Moon, Sun, History, MessageCircle, HelpCircle, Sparkles, Settings } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

export function Navbar() {
    const { darkMode, toggleDarkMode } = useSettingsStore()
    const location = useLocation()

    const isActive = (path: string) => location.pathname === path

    const navItems = [
        { path: '/chat', label: '对话', icon: MessageCircle },
        { path: '/qa', label: '问答', icon: HelpCircle },
        { path: '/history', label: '历史', icon: History },
    ]

    return (
        <nav className="sticky top-0 z-50 glass border-b-0">
            <div className="container mx-auto px-6 h-16 flex justify-between items-center">
                {/* Logo */}
                <Link
                    to="/"
                    className="flex items-center gap-3 group"
                >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-foreground/90 group-hover:text-primary transition-colors">
                        AIgument
                    </span>
                </Link>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                    {navItems.map(({ path, label, icon: Icon }) => (
                        <Link key={path} to={path}>
                            <Button
                                variant="ghost"
                                className={`
                                    hidden sm:flex items-center gap-2 rounded-lg px-3 py-2 
                                    transition-all duration-200 text-sm font-medium
                                    ${isActive(path)
                                        ? 'text-primary bg-primary/5'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }
                                `}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{label}</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`
                                    sm:hidden rounded-lg transition-all duration-200
                                    ${isActive(path)
                                        ? 'text-primary bg-primary/5'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }
                                `}
                            >
                                <Icon className="h-4 w-4" />
                            </Button>
                        </Link>
                    ))}

                    {/* Divider */}
                    <div className="w-px h-4 bg-border/50 mx-2 hidden sm:block" />

                    {/* Settings */}
                    <Link to="/settings">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`
                                rounded-lg transition-all duration-200
                                ${isActive('/settings')
                                    ? 'text-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground'
                                }
                            `}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </Link>

                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleDarkMode}
                        className="rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200"
                    >
                        {darkMode ? (
                            <Sun className="h-4 w-4" />
                        ) : (
                            <Moon className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </nav>
    )
}
