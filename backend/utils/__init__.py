"""
工具模块
"""
import os
from config import get_settings
from .logger import get_logger, log_request, log_ai_call, log_debate_event
from .prompting import resolve_prompt
from .sse import sse_event, sse_response


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


__all__ = [
    "get_logger",
    "log_request", 
    "log_ai_call",
    "log_debate_event",
    "get_api_key",
    "resolve_prompt",
    "sse_event",
    "sse_response",
]
