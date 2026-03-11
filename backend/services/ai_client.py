"""
AI 客户端封装 - 支持多提供商

统一的 AI 调用入口，通过 Provider 策略模式支持：
- DeepSeek / OpenAI（OpenAI 兼容接口）
- Google Gemini
- Anthropic Claude
- Mock（测试用）

所有 IO 操作均为异步，避免阻塞 FastAPI 事件循环。
"""
from typing import AsyncGenerator, Optional

from services.providers import BaseProvider, create_provider


class AIClient:
    """统一的 AI 客户端，委托给具体 Provider 实现。

    用法：
        client = AIClient(provider="deepseek", model="deepseek-chat", api_key=...)
        text = await client.get_completion(messages)
        async for chunk in client.chat_stream(messages):
            ...
    """

    def __init__(
        self,
        provider: str = "deepseek",
        model: str = "deepseek-chat",
        api_key: Optional[str] = None,
        seed: Optional[int] = None,
    ):
        self.provider = provider
        self.model = model
        self.seed = seed
        self._provider: BaseProvider = create_provider(
            provider=provider,
            model=model,
            api_key=api_key,
            seed=seed,
        )

    async def get_completion(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs,
    ) -> str:
        """获取完整回复（非流式）"""
        return await self._provider.get_completion(
            messages, temperature=temperature, max_tokens=max_tokens, **kwargs
        )

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """流式获取回复（异步生成器）"""
        async for chunk in self._provider.chat_stream(
            messages, temperature=temperature, max_tokens=max_tokens, **kwargs
        ):
            yield chunk
