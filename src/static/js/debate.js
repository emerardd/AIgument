/**
 * 辩论模式相关功能
 */

// 常规非流式辩论
async function regularDebate(topic, rounds, historyContainer, provider = "deepseek", model = "deepseek-chat") {
    try {
        // 初始化辩论会话
        const initResponse = await fetch('/api/debate/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic,
                rounds,
                provider,
                model
            })
        });
        
        if (!initResponse.ok) {
            throw new Error('初始化辩论失败');
        }
        
        const initData = await initResponse.json();
        const sessionId = initData.session_id;
        
        // 创建轮次容器
        for (let round = 1; round <= rounds; round++) {
            // 创建轮次标题
            const roundTitle = document.createElement('h3');
            roundTitle.className = 'text-xl font-bold mb-4 mt-8';
            roundTitle.textContent = `第 ${round} 轮辩论`;
            historyContainer.appendChild(roundTitle);
            
            // 正方回应
            const positiveResponse = await fetch('/api/debate/single', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topic: round === 1 ? topic : '请继续辩论',
                    side: '正方',
                    round,
                    provider,
                    model,
                    session_id: sessionId
                })
            });
            
            if (!positiveResponse.ok) {
                throw new Error('获取正方回应失败');
            }
            
            const positiveData = await positiveResponse.json();
            
            // 显示正方内容
            const positiveContainer = document.createElement('div');
            positiveContainer.className = 'mb-6';
            positiveContainer.innerHTML = `
                <div class="card p-6">
                    <h4 class="text-lg font-semibold mb-2 text-blue-600">正方观点</h4>
                    <div class="markdown-content">${renderMarkdown(positiveData.content)}</div>
                </div>
            `;
            historyContainer.appendChild(positiveContainer);
            
            // 反方回应
            const negativeResponse = await fetch('/api/debate/single', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topic: positiveData.content,
                    side: '反方',
                    round,
                    provider,
                    model,
                    session_id: sessionId
                })
            });
            
            if (!negativeResponse.ok) {
                throw new Error('获取反方回应失败');
            }
            
            const negativeData = await negativeResponse.json();
            
            // 显示反方内容
            const negativeContainer = document.createElement('div');
            negativeContainer.className = 'mb-6';
            negativeContainer.innerHTML = `
                <div class="card p-6">
                    <h4 class="text-lg font-semibold mb-2 text-red-600">反方观点</h4>
                    <div class="markdown-content">${renderMarkdown(negativeData.content)}</div>
                </div>
            `;
            historyContainer.appendChild(negativeContainer);
        }
        
        return new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.error('辩论过程错误:', error);
        showError(error.message || '生成辩论内容时出错');
    }
}

// 流式辩论
async function streamDebate(topic, rounds, historyContainer, provider = "deepseek", model = "deepseek-chat") {
    try {
        // 初始化辩论
        const initResponse = await fetch('/api/debate/init', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                topic, 
                rounds,
                provider,
                model
            })
        });
        
        if (!initResponse.ok) {
            const errorData = await initResponse.json();
            throw new Error(errorData.error || '初始化辩论失败');
        }
        
        // 创建轮次容器
        let roundContainers = {};
        for (let i = 1; i <= rounds; i++) {
            const roundContainer = document.createElement('div');
            roundContainer.className = 'mb-6 animate__animated animate__fadeIn';
            roundContainer.style.animationDelay = `${(i-1)*0.3}s`;
            roundContainer.innerHTML = `<h3 class="text-lg font-semibold mb-3">第 ${i} 轮</h3>`;
            historyContainer.appendChild(roundContainer);
            roundContainers[i] = roundContainer;
        }
        
        // 为每轮每个辩论方创建内容容器
        let contentElements = {};
        for (let round = 1; round <= rounds; round++) {
            for (let side of ['正方', '反方']) {
                const key = `${round}-${side}`;
                const viewElement = document.createElement('div');
                viewElement.className = `card p-6 mb-4 animate__animated animate__fadeIn`;
                viewElement.style.animationDelay = `${(round-1)*0.3 + (side==='正方'?0.1:0.2)}s`;
                
                const sideClass = side === '正方' ? 'text-blue-600' : 'text-red-600';
                viewElement.innerHTML = `
                    <h4 class="text-lg font-semibold mb-2 ${sideClass}">${side}观点</h4>
                    <div id="content-${key}" class="text-gray-700 markdown-content">
                        <div class="flex items-center space-x-2">
                            <div class="w-3 h-3 bg-${side === '正方' ? 'blue' : 'red'}-500 rounded-full pulse"></div>
                            <span>${DOMPurify.sanitize('正在思考中...')}</span>
                        </div>
                    </div>
                `;
                roundContainers[round].appendChild(viewElement);
                contentElements[key] = document.getElementById(`content-${key}`);
            }
        }
        
        // 设置SSE来接收流式内容
        const eventSource = new EventSource(`/api/debate/stream?topic=${encodeURIComponent(topic)}&rounds=${rounds}&provider=${provider}&model=${model}`);
        
        eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === "content") {
                const key = `${data.round}-${data.side}`;
                const contentElement = contentElements[key];
                if (contentElement) {
                    contentElement.innerHTML = renderMarkdown(data.content);
                    
                    // 应用代码高亮
                    contentElement.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
            }
        };
        
        eventSource.addEventListener('debate_complete', function(event) {
            eventSource.close();
            const data = JSON.parse(event.data);
            console.log('辩论完成:', data.message);
        });
        
        eventSource.addEventListener('error', function(event) {
            eventSource.close();
            const data = event.data ? JSON.parse(event.data) : { message: '流式接收数据时出错' };
            console.error('流式辩论错误:', data.message);
            showError(data.message);
        });
        
        // 返回一个Promise，等待辩论完成
        return new Promise((resolve, reject) => {
            eventSource.addEventListener('debate_complete', () => {
                resolve();
            });
            
            eventSource.addEventListener('error', (event) => {
                const data = event.data ? JSON.parse(event.data) : { message: '流式接收数据时出错' };
                reject(new Error(data.message));
            });
        });
        
    } catch (error) {
        console.error('流式辩论请求失败:', error);
        showError(error.message || '生成辩论内容时出错');
    }
}

// 逐步显示辩论历史（带有动画效果）
async function renderDebateHistoryWithAnimation(history) {
    // 按时间顺序逐个显示
    for (const item of history) {
        const key = `${item.round}-${item.side}`;
        const contentElement = document.getElementById(`content-${key}`);
        
        if (contentElement) {
            // 清除加载指示器
            contentElement.innerHTML = '';
            
            // 使用打字机效果显示内容
            typeWriter(contentElement, item.content);
            
            // 等待一段时间再显示下一个，模拟真实辩论过程
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// 渲染辩论历史
function renderDebateHistory(history, container) {
    // 按轮次分组
    const rounds = {};
    history.forEach(item => {
        if (!rounds[item.round]) {
            rounds[item.round] = [];
        }
        rounds[item.round].push(item);
    });
    
    // 渲染每一轮
    for (const [round, items] of Object.entries(rounds)) {
        const roundContainer = document.createElement('div');
        roundContainer.className = 'mb-6 animate__animated animate__fadeIn';
        roundContainer.innerHTML = `<h3 class="text-lg font-semibold mb-3">第 ${round} 轮</h3>`;
        container.appendChild(roundContainer);
        
        // 渲染该轮的观点
        items.forEach(item => {
            const viewElement = document.createElement('div');
            viewElement.className = 'card p-6 mb-4 animate__animated animate__fadeIn';
            
            const sideClass = item.side === '正方' ? 'text-blue-600' : 'text-red-600';
            viewElement.innerHTML = `
                <h4 class="text-lg font-semibold mb-2 ${sideClass}">${item.side}观点</h4>
                <div class="text-gray-700 markdown-content">${renderMarkdown(item.content)}</div>
            `;
            
            roundContainer.appendChild(viewElement);
            
            // 应用代码高亮
            viewElement.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        });
    }
} 