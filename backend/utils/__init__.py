"""
工具模块
"""
import os

from config import get_settings
from exceptions import APIKeyMissingException, ProviderNotSupportedException
from .logger import get_logger, log_request, log_ai_call, log_debate_event
from .prompting import resolve_prompt
from .session_state import mark_session_status, merge_session_settings
from .sse import sse_event, sse_response


def get_api_key(provider: str = "deepseek") -> str:
    """获取API密钥"""
    settings = get_settings()
    key_map = {
        "deepseek": settings.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY", ""),
        "openai": settings.openai_api_key or os.getenv("OPENAI_API_KEY", ""),
        "gemini": settings.gemini_api_key or os.getenv("GEMINI_API_KEY", ""),
        "claude": settings.claude_api_key or os.getenv("CLAUDE_API_KEY", ""),
    }

    if provider == "mock":
        return "mock"

    if provider not in key_map:
        raise ProviderNotSupportedException(provider)

    api_key = key_map[provider]
    if not api_key:
        raise APIKeyMissingException(provider)
    return api_key


__all__ = [
    "get_logger",
    "log_request",
    "log_ai_call",
    "log_debate_event",
    "get_api_key",
    "resolve_prompt",
    "mark_session_status",
    "merge_session_settings",
    "sse_event",
    "sse_response",
]
