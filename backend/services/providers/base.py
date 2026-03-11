"""
Provider 抽象基类

定义所有 AI Provider 的统一异步接口。
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator


class BaseProvider(ABC):
    """AI Provider 抽象基类"""

    @abstractmethod
    async def get_completion(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs,
    ) -> str:
        """获取完整回复（非流式）"""

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """流式获取回复"""
