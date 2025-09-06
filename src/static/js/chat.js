/**
 * 对话模式相关功能
 */

// 对话模式功能
async function startChat(topic, rounds, container, role1, role2, streamMode, provider = "deepseek", model = "deepseek-chat") {
    try {
        // 模拟角色对话数据
        // 实际应用中应调用后端API
        const roleNames = {
            'scientist': '科学家',
            'philosopher': '哲学家',
            'writer': '作家',
            'businessman': '商人',
            'teacher': '教师',
            'lawyer': '律师',
        };
        
        const roleColors = {
            'scientist': 'text-purple-600',
            'philosopher': 'text-indigo-600',
            'writer': 'text-green-600',
            'businessman': 'text-yellow-600',
            'teacher': 'text-blue-600',
            'lawyer': 'text-red-600',
        };
        
        // 模拟对话数据
        // 这部分应该通过API请求获取
        const conversations = [];
        for (let i = 0; i < rounds; i++) {
            conversations.push({
                role1: `作为${roleNames[role1]}，我认为关于"${topic}"这个话题，从专业角度来看，我们应该考虑以下几点：\n\n1. 首先，...\n2. 其次，...\n\n总的来说，这是一个值得深入探讨的话题。`,
                role2: `作为${roleNames[role2]}，我想从不同角度补充一下：\n\n- 从我的专业领域看，...\n- 此外，我们还需要考虑...\n\n这些观点或许能提供一些新的思考方向。`
            });
        }
        
        // 创建对话容器
        for (let i = 0; i < rounds; i++) {
            const roundContainer = document.createElement('div');
            roundContainer.className = 'mb-6 animate__animated animate__fadeIn';
            roundContainer.style.animationDelay = `${i*0.3}s`;
            roundContainer.innerHTML = `<h3 class="text-lg font-semibold mb-3">第 ${i+1} 轮对话</h3>`;
            container.appendChild(roundContainer);
            
            // 第一个角色发言
            const role1Element = document.createElement('div');
            role1Element.className = 'card p-6 mb-4 animate__animated animate__fadeIn';
            role1Element.style.animationDelay = `${i*0.3 + 0.1}s`;
            
            const role1ContentElement = document.createElement('div');
            role1ContentElement.className = 'text-gray-700 markdown-content';
            
            role1Element.innerHTML = `
                <h4 class="text-lg font-semibold mb-2 ${roleColors[role1]}">AI角色1 (${roleNames[role1]})</h4>
            `;
            
            role1Element.appendChild(role1ContentElement);
            roundContainer.appendChild(role1Element);
            
            // 第二个角色发言
            const role2Element = document.createElement('div');
            role2Element.className = 'card p-6 mb-4 animate__animated animate__fadeIn';
            role2Element.style.animationDelay = `${i*0.3 + 0.2}s`;
            
            const role2ContentElement = document.createElement('div');
            role2ContentElement.className = 'text-gray-700 markdown-content';
            
            role2Element.innerHTML = `
                <h4 class="text-lg font-semibold mb-2 ${roleColors[role2]}">AI角色2 (${roleNames[role2]})</h4>
            `;
            
            role2Element.appendChild(role2ContentElement);
            roundContainer.appendChild(role2Element);
            
            // 使用打字机效果显示内容
            if (streamMode) {
                // 模拟流式输出
                typeWriter(role1ContentElement, conversations[i].role1);
                setTimeout(() => {
                    typeWriter(role2ContentElement, conversations[i].role2);
                }, 3000); // 延迟显示第二个角色的回复
            } else {
                // 直接显示全部内容（经XSS防护）
                role1ContentElement.innerHTML = renderMarkdown(conversations[i].role1);
                role2ContentElement.innerHTML = renderMarkdown(conversations[i].role2);
                
                // 应用代码高亮
                role1ContentElement.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
                role2ContentElement.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        }
        
        return new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.error('对话模式错误:', error);
        showError(error.message || '生成对话内容时出错');
    }
} 