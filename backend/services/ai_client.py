"""
Unified async AI client with lightweight retries.
"""

import asyncio
from typing import AsyncGenerator, Optional

from exceptions import AIClientException
from services.providers import BaseProvider, create_provider
from utils.logger import get_logger


logger = get_logger(__name__)


class AIClient:
    """Provider-agnostic async AI client."""

    def __init__(
        self,
        provider: str = "deepseek",
        model: str = "deepseek-chat",
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
                if attempt >= self.retry_attempts:
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

        raise AIClientException(
            f"Completion failed after {self.retry_attempts} attempts: {last_error}",
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
            raise AIClientException(
                f"Streaming failed: {exc}",
                provider=self.provider,
                model=self.model,
            ) from exc
