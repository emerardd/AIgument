/**
 * 问答模式相关功能
 */

// 处理问答模式
async function processQuestion(question, style, container, provider = "deepseek", model = "deepseek-chat") {
    try {
        // 清除现有的回答
        container.innerHTML = '';
        
        // 创建用户问题区域
        const questionElement = document.createElement('div');
        questionElement.className = 'card p-6 mb-4 animate__animated animate__fadeIn';
        questionElement.innerHTML = `
            <h4 class="text-lg font-semibold mb-2 text-gray-700">您的问题</h4>
            <div class="text-gray-700">${DOMPurify.sanitize(question)}</div>
        `;
        container.appendChild(questionElement);
        
        // 创建AI回答区域
        const aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'card p-6 mb-4 animate__animated animate__fadeIn';
        
        const contentElement = document.createElement('div');
        contentElement.className = 'text-gray-700 markdown-content';
        
        aiResponseElement.innerHTML = `
            <h4 class="text-lg font-semibold mb-2 text-blue-600">AI助手</h4>
            <div class="flex items-center space-x-2 mb-2">
                <div class="w-3 h-3 bg-blue-500 rounded-full pulse"></div>
                <span>正在生成回答...</span>
            </div>
        `;
        
        aiResponseElement.appendChild(contentElement);
        container.appendChild(aiResponseElement);
        
        // 在实际应用中，这里应该调用后端API获取回答
        // 这里使用模拟数据
        let response = '';
        
        if (style === 'comprehensive') {
            response = `关于"${question}"的详细解答：

## 背景

这个问题涉及到...（相关背景介绍）

## 核心概念分析

1. **第一个核心概念**
   - 具体解释
   - 相关理论

2. **第二个核心概念**
   - 定义和范围
   - 实际应用

## 不同观点

有以下几种主要观点：

* 观点一：支持者认为...
* 观点二：反对者则认为...

## 实际案例

以下案例可以帮助理解：

\`\`\`
案例细节和代码示例（如适用）
\`\`\`

## 结论

综合以上分析，我们可以得出...

希望这个详细的解答对您有所帮助！如果您有任何后续问题，请随时提出。`;
        } else if (style === 'concise') {
            response = `关于"${question}"，简洁回答如下：

这个问题的核心在于...（关键点）。从主要证据来看，可以得出...（结论）。

需要注意的是...（重要提示）。`;
        } else if (style === 'socratic') {
            response = `关于"${question}"，我想请您思考以下几个问题：

1. 您认为这个问题的核心是什么？
2. 如果从不同角度看，会有什么不同的理解？
3. 这个问题的前提假设是否成立？

思考这些问题可能会帮助您找到更深层次的答案。您对第一个问题有什么想法？`;
        }
        
        // 移除加载指示器
        const loadingElement = aiResponseElement.querySelector('.flex.items-center.space-x-2');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        // 使用打字机效果显示内容
        typeWriter(contentElement, response);
        
        // 添加追问输入框
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const followUpContainer = document.createElement('div');
        followUpContainer.className = 'mb-6 animate__animated animate__fadeIn';
        followUpContainer.innerHTML = `
            <div class="card p-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">继续提问</label>
                <div class="flex">
                    <input type="text" id="follow-up-question" 
                           class="w-full px-4 py-2 rounded-l-lg border focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                           placeholder="输入您的追问...">
                    <button id="send-follow-up" 
                            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-lg transition-all">
                        发送
                    </button>
                </div>
            </div>
        `;
        container.appendChild(followUpContainer);
        
        // 为追问按钮添加事件监听
        document.getElementById('send-follow-up').addEventListener('click', async () => {
            const followUpQuestion = document.getElementById('follow-up-question').value.trim();
            if (followUpQuestion) {
                await processFollowUpQuestion(followUpQuestion, style, container, provider, model);
                document.getElementById('follow-up-question').value = ''; // 清空输入框
            }
        });
        
        return new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.error('问答模式错误:', error);
        showError(error.message || '生成问答内容时出错');
    }
}

// 处理追问
async function processFollowUpQuestion(question, style, container, provider = "deepseek", model = "deepseek-chat") {
    try {
        // 创建用户追问区域
        const questionElement = document.createElement('div');
        questionElement.className = 'card p-6 mb-4 animate__animated animate__fadeIn';
        questionElement.innerHTML = `
            <h4 class="text-lg font-semibold mb-2 text-gray-700">您的追问</h4>
            <div class="text-gray-700">${DOMPurify.sanitize(question)}</div>
        `;
        container.appendChild(questionElement);
        
        // 创建AI回答区域
        const aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'card p-6 mb-4 animate__animated animate__fadeIn';
        
        const contentElement = document.createElement('div');
        contentElement.className = 'text-gray-700 markdown-content';
        
        aiResponseElement.innerHTML = `
            <h4 class="text-lg font-semibold mb-2 text-blue-600">AI助手</h4>
        `;
        
        aiResponseElement.appendChild(contentElement);
        container.appendChild(aiResponseElement);
        
        // 模拟AI回应
        const response = `感谢您的追问！

关于"${question}"，我可以进一步解释：

这是一个很好的后续问题，它帮助我们更深入地探讨了主题的核心。从专业角度来看，这涉及到...

希望这个解答对您有帮助。您还有其他疑问吗？`;
        
        // 使用打字机效果显示内容
        typeWriter(contentElement, response);
        
        return new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.error('处理追问错误:', error);
        showError(error.message || '生成追问回答时出错');
    }
} 