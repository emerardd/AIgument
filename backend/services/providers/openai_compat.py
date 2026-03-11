"""
OpenAI 兼容 Provider（适用于 DeepSeek 和 OpenAI）

使用 AsyncOpenAI 客户端，支持连接池复用。
"""
from typing import AsyncGenerator, Dict, Optional
import httpx
from openai import AsyncOpenAI

from .base import BaseProvider


class OpenAICompatProvider(BaseProvider):
    """OpenAI 兼容 API Provider（DeepSeek / OpenAI）

    类级别连接池，相同配置复用同一 AsyncOpenAI 实例。
    """

    _client_pool: Dict[str, AsyncOpenAI] = {}

    @classmethod
    def _get_or_create_client(
        cls,
        pool_key: str,
        api_key: str,
        base_url: str,
        timeout: httpx.Timeout,
    ) -> AsyncOpenAI:
        if pool_key not in cls._client_pool:
            cls._client_pool[pool_key] = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=timeout,
            )
        return cls._client_pool[pool_key]

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        seed: Optional[int] = None,
    ):
        self.model = model
        self.seed = seed
        timeout = httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=10.0)
        pool_key = f"{api_key[:8]}:{base_url}"
        self.client = self._get_or_create_client(pool_key, api_key, base_url, timeout)

    def _build_payload(self, messages, temperature, max_tokens, stream=False) -> dict:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        if self.seed is not None:
            payload["seed"] = self.seed
        return payload

    async def get_completion(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> str:
        response = await self.client.chat.completions.create(
            **self._build_payload(messages, temperature, max_tokens, stream=False)
        )
        return response.choices[0].message.content

    async def chat_stream(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            **self._build_payload(messages, temperature, max_tokens, stream=True)
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
