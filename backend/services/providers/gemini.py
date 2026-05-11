"""
Google Gemini Provider

使用 google-genai SDK 的异步接口，并正确转换多轮消息格式。
"""
from typing import AsyncGenerator

from .base import BaseProvider


class GeminiProvider(BaseProvider):
    """Google Gemini Provider"""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        from google import genai as google_genai
        self.client = google_genai.Client(api_key=self.api_key)

    def _convert_messages(self, messages: list[dict]):
        """将 OpenAI 格式消息转换为 Gemini Contents + system_instruction"""
        from google.genai import types as genai_types

        system_instruction = ""
        contents = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_instruction = content
            elif role == "assistant":
                contents.append(
                    genai_types.Content(
                        role="model",
                        parts=[genai_types.Part(text=content)],
                    )
                )
            else:
                contents.append(
                    genai_types.Content(
                        role="user",
                        parts=[genai_types.Part(text=content)],
                    )
                )

        return system_instruction, contents

    def _build_config(self, temperature, max_tokens, system_instruction):
        from google.genai import types as genai_types

        return genai_types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            system_instruction=system_instruction or None,
        )

    async def get_completion(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> str:
        system_instruction, contents = self._convert_messages(messages)
        config = self._build_config(temperature, max_tokens, system_instruction)

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )
        if not response.text:
            raise ValueError("Gemini API returned empty response")
        return response.text

    async def chat_stream(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> AsyncGenerator[str, None]:
        system_instruction, contents = self._convert_messages(messages)
        config = self._build_config(temperature, max_tokens, system_instruction)

        async for chunk in await self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        ):
            if chunk.text:
                yield chunk.text
