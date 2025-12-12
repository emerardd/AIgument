"""
公共工具函数
"""
import os
from config import get_settings


def get_api_key(provider: str = "deepseek") -> str:
    """获取API密钥"""
    settings = get_settings()
    if provider == "deepseek":
        return settings.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY", "")
    elif provider == "openai":
        return settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")
    elif provider == "gemini":
        return settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
    elif provider == "claude":
        return settings.claude_api_key or os.getenv("CLAUDE_API_KEY", "")
    return ""
