"""
Anthropic Claude Provider

使用 anthropic SDK 的异步接口。
"""
from typing import AsyncGenerator

from .base import BaseProvider


class ClaudeProvider(BaseProvider):
    """Anthropic Claude Provider"""

    def __init__(self, api_key: str, model: str):
        import anthropic
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    def _convert_messages(self, messages: list[dict]) -> tuple[str, list[dict]]:
        """分离 system prompt 和对话消息"""
        system_prompt = ""
        claude_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_prompt = content
            else:
                claude_messages.append({
                    "role": "assistant" if role == "assistant" else "user",
                    "content": content,
                })
        return system_prompt, claude_messages

    async def get_completion(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> str:
        system_prompt, claude_messages = self._convert_messages(messages)
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=claude_messages,
        )
        return response.content[0].text

    async def chat_stream(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> AsyncGenerator[str, None]:
        system_prompt, claude_messages = self._convert_messages(messages)
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=claude_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
