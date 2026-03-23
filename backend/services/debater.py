"""
Legacy debate service kept for compatibility.
"""

import asyncio
from typing import AsyncGenerator, Optional, Union

from .ai_client import AIClient
from utils.logger import get_logger

logger = get_logger(__name__)


class Debater:
    """Simple prompt-driven debater."""

    def __init__(
        self,
        name: str,
        system_prompt: str,
        provider: str = "deepseek",
        model: str = "deepseek-chat",
        api_key: Optional[str] = None,
        temperature: float = 0.7,
        seed: Optional[int] = None
    ):
        self.name = name
        self.system_prompt = system_prompt
        self.provider = provider
        self.model = model
        self.temperature = temperature
        self.conversation_history: list[dict] = []
        self.client = AIClient(provider=provider, model=model, api_key=api_key, seed=seed)

    def _build_messages(self, opponent_message: str) -> list[dict]:
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(self.conversation_history)
        messages.append({"role": "user", "content": opponent_message})
        return messages

    async def generate_response(self, opponent_message: str) -> str:
        messages = self._build_messages(opponent_message)

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response_content = await self.client.get_completion(messages, temperature=self.temperature)
                self.conversation_history.append({"role": "user", "content": opponent_message})
                self.conversation_history.append({"role": "assistant", "content": response_content})
                return response_content
            except Exception:
                logger.exception("Debater API调用失败 (尝试 %s/%s)", attempt + 1, max_retries)
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(1)

        return ""

    async def stream_response(self, opponent_message: str) -> AsyncGenerator[str, None]:
        messages = self._build_messages(opponent_message)

        try:
            full_response = ""
            async for content in self.client.chat_stream(messages, temperature=self.temperature):
                full_response += content
                yield content

            self.conversation_history.append({"role": "user", "content": opponent_message})
            self.conversation_history.append({"role": "assistant", "content": full_response})
        except Exception:
            logger.exception("Debater流式API调用错误")
            raise

    def get_response(self, opponent_message: str, stream: bool = False) -> Union["asyncio.Future[str]", AsyncGenerator[str, None]]:
        if stream:
            return self.stream_response(opponent_message)
        return self.generate_response(opponent_message)
