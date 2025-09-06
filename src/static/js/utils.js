/**
 * 实用工具函数
 */

// 打字机效果函数
function typeWriter(element, text, speed = 10) {
    // 检查是否包含markdown格式，如果包含则先通过marked解析
    const parsedText = marked.parse(text);
    
    // 设置内容（先进行XSS防护）
    const safeHtml = DOMPurify.sanitize(parsedText);
    element.innerHTML = safeHtml;
    
    // 应用代码高亮
    element.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
    
    // 添加打字机动画类
    element.classList.add('typing-effect');
    
    // 一段时间后移除动画类
    setTimeout(() => {
        element.classList.remove('typing-effect');
    }, text.length * speed + 1000);
}

// 显示错误信息
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // 添加动画类
    errorDiv.classList.add('animate__animated', 'animate__shakeX');
    
    // 移除动画类以便将来可以再次触发
    setTimeout(() => {
        errorDiv.classList.remove('animate__animated', 'animate__shakeX');
    }, 1000);
}

/**
 * 将Markdown转换为HTML，并处理代码高亮
 * @param {string} markdown - Markdown格式的文本
 * @returns {string} 转换后的HTML
 */
function renderMarkdown(markdown) {
    // 配置marked选项
    marked.setOptions({
        highlight: function(code, lang) {
            try {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            } catch (e) {
                return hljs.highlightAuto(code).value;
            }
        }
    });
    
    // 转换Markdown为HTML并进行XSS防护
    const html = marked.parse(markdown);
    return DOMPurify.sanitize(html);
}

/**
 * 格式化日期时间
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * 截断文本并添加省略号
 * @param {string} text - 要截断的文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 主题切换功能
document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('theme-toggle');
    
    // 如果存在主题切换按钮
    if (themeToggle) {
        // 检查本地存储中是否有主题设置
        const currentTheme = localStorage.getItem('theme');
        
        // 如果是暗黑模式，应用暗黑模式样式
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-theme');
            updateThemeIcon(true);
        }
        
        // 添加点击事件监听器
        themeToggle.addEventListener('click', function() {
            // 切换暗黑模式类
            document.body.classList.toggle('dark-theme');
            
            // 检查当前模式并更新localStorage
            const isDarkMode = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            
            // 更新图标
            updateThemeIcon(isDarkMode);
        });
    }
    
    // 设置按钮功能
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            alert('设置功能即将推出！');
        });
    }
});

/**
 * 更新主题切换按钮的图标
 * @param {boolean} isDarkMode - 是否为暗黑模式
 */
function updateThemeIcon(isDarkMode) {
    const iconElement = document.querySelector('#theme-toggle .nav-icon');
    if (iconElement) {
        if (isDarkMode) {
            iconElement.classList.remove('fa-moon');
            iconElement.classList.add('fa-sun');
        } else {
            iconElement.classList.remove('fa-sun');
            iconElement.classList.add('fa-moon');
        }
    }
}

// 添加用于动画元素的IntersectionObserver
document.addEventListener('DOMContentLoaded', function() {
    // 检查浏览器是否支持IntersectionObserver
    if ('IntersectionObserver' in window) {
        const fadeElements = document.querySelectorAll('.fade-in-element');
        
        const appearOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };
        
        const appearOnScroll = new IntersectionObserver(function(entries, observer) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, appearOptions);
        
        fadeElements.forEach(element => {
            appearOnScroll.observe(element);
        });
    }
}); 