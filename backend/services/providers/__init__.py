"""
AI Provider 工厂

根据 provider 名称创建对应的 Provider 实例。
"""
from typing import Optional

from config import get_settings
from .base import BaseProvider
from .openai_compat import OpenAICompatProvider
from .gemini import GeminiProvider
from .claude import ClaudeProvider
from .mock import MockProvider


def create_provider(
    provider: str,
    model: str,
    api_key: Optional[str] = None,
    seed: Optional[int] = None,
) -> BaseProvider:
    """工厂函数：根据 provider 名称创建对应实例

    Args:
        provider: 提供商名称（deepseek / openai / gemini / claude / mock）
        model: 模型名称
        api_key: API 密钥（可选，优先于环境变量）
        seed: 随机种子（仅 OpenAI 兼容接口支持）

    Returns:
        BaseProvider 实例
    """
    settings = get_settings()

    if provider == "deepseek":
        key = api_key or settings.deepseek_api_key
        return OpenAICompatProvider(
            api_key=key,
            base_url=settings.deepseek_api_base,
            model=model,
            seed=seed,
        )

    if provider == "openai":
        key = api_key or settings.openai_api_key
        return OpenAICompatProvider(
            api_key=key,
            base_url=settings.openai_api_base,
            model=model,
            seed=seed,
        )

    if provider == "gemini":
        key = api_key or settings.gemini_api_key
        return GeminiProvider(api_key=key, model=model)

    if provider == "claude":
        key = api_key or settings.claude_api_key
        return ClaudeProvider(api_key=key, model=model)

    if provider == "mock":
        return MockProvider(model=model, seed=seed)

    raise ValueError(f"不支持的提供商: {provider}")


__all__ = ["BaseProvider", "create_provider"]
