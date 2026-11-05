"""
Unified async AI client with lightweight retries.
"""

import asyncio
from typing import AsyncGenerator, Optional

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from exceptions import AIClientException
from services.providers import BaseProvider, create_provider
from utils.logger import get_logger


logger = get_logger(__name__)

PROVIDER_LABELS = {
    "deepseek": "DeepSeek",
    "openai": "OpenAI",
    "gemini": "Gemini",
    "claude": "Claude",
    "mock": "Mock",
}


def _status_code(exc: BaseException) -> int | None:
    """HTTP status from the various SDK exception shapes, if any."""
    for candidate in (
        getattr(exc, "status_code", None),
        getattr(getattr(exc, "response", None), "status_code", None),
        getattr(exc, "code", None),
    ):
        if isinstance(candidate, int):
            return candidate
    return None


def _kind(exc: BaseException) -> str:
    status = _status_code(exc)
    text = str(exc).lower()
    if status in (401, 403) or any(k in text for k in ("authentication", "unauthorized", "invalid api key", "api key")):
        return "auth"
    if status == 404 or "model_not_found" in text or "does not exist" in text:
        return "model"
    if status == 429 or any(k in text for k in ("rate limit", "quota", "insufficient")):
        return "quota"
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)) or "timed out" in text or "timeout" in text:
        return "timeout"
    if "connect" in text:
        return "network"
    return "other"


def describe_failure(provider: str, model: str, exc: BaseException) -> str:
    """A message the user can act on. Raw SDK text (which may echo part of the key) stays in the log."""
    label = PROVIDER_LABELS.get(provider, provider)
    return {
        "auth": f"{label} 拒绝了 API 密钥，请到设置页更新密钥后重试。",
        "model": f"{label} 找不到模型 {model}，请到设置页换一个模型。",
        "quota": f"{label} 提示请求过多或额度不足，请稍后重试或检查账户余额。",
        "timeout": f"连接 {label} 超时，请检查网络后重试。",
        "network": f"无法连接 {label}，请检查网络或代理设置。",
    }.get(_kind(exc), f"{label}（{model}）调用失败，详细原因已写入后端日志。")


# Retrying cannot fix these.
_PERMANENT = {"auth", "model"}


class AIClient:
    """Provider-agnostic async AI client."""

    def __init__(
        self,
        provider: str = DEFAULT_PROVIDER,
        model: str = DEFAULT_MODEL,
        api_key: Optional[str] = None,
        seed: Optional[int] = None,
        retry_attempts: int = 2,
        retry_delay: float = 0.5,
    ):
        self.provider = provider
        self.model = model
        self.seed = seed
        self.retry_attempts = max(1, retry_attempts)
        self.retry_delay = max(0.0, retry_delay)
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
        """Get a full completion with small bounded retries."""
        last_error: Exception | None = None

        for attempt in range(1, self.retry_attempts + 1):
            try:
                return await self._provider.get_completion(
                    messages, temperature=temperature, max_tokens=max_tokens, **kwargs
                )
            except Exception as exc:
                last_error = exc
                if attempt >= self.retry_attempts or _kind(exc) in _PERMANENT:
                    break
                logger.warning(
                    "AI completion failed (%s/%s) for %s/%s: %s",
                    attempt,
                    self.retry_attempts,
                    self.provider,
                    self.model,
                    exc,
                )
                await asyncio.sleep(self.retry_delay * attempt)

        logger.error("AI completion failed for %s/%s: %s", self.provider, self.model, last_error)
        raise AIClientException(
            describe_failure(self.provider, self.model, last_error),
            provider=self.provider,
            model=self.model,
        ) from last_error

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Stream a completion and normalize provider errors."""
        try:
            async for chunk in self._provider.chat_stream(
                messages, temperature=temperature, max_tokens=max_tokens, **kwargs
            ):
                yield chunk
        except Exception as exc:
            logger.error("AI stream failed for %s/%s: %s", self.provider, self.model, exc)
            raise AIClientException(
                describe_failure(self.provider, self.model, exc),
                provider=self.provider,
                model=self.model,
            ) from exc
