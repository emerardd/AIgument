export function Footer() {
    return (
        <footer className="mt-auto py-6 border-t bg-background">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        © 2024 AIgument. 智能对话平台
                    </p>

                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground transition-colors"
                        >
                            GitHub
                        </a>
                        <a
                            href="#"
                            className="hover:text-foreground transition-colors"
                        >
                            文档
                        </a>
                        <a
                            href="#"
                            className="hover:text-foreground transition-colors"
                        >
                            关于
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
