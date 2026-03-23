"""
AI client tests aligned with the provider-based implementation.
"""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from exceptions import AIClientException
from services.ai_client import AIClient


class TestAIClientInit:
    def test_deepseek_init(self):
        client = AIClient(provider="deepseek", model="deepseek-chat", api_key="test_key")
        assert client.provider == "deepseek"
        assert client.model == "deepseek-chat"
        assert client._provider is not None

    def test_openai_init(self):
        client = AIClient(provider="openai", model="gpt-4", api_key="test_key")
        assert client.provider == "openai"
        assert client.model == "gpt-4"
        assert client._provider is not None

    def test_unsupported_provider(self):
        with pytest.raises(ValueError):
            AIClient(provider="unknown_provider", model="test")


class TestMockReproducibility:
    def test_mock_same_seed_same_output(self):
        messages = [{"role": "user", "content": "reproducibility check"}]
        client_a = AIClient(provider="mock", model="mock", seed=123)
        client_b = AIClient(provider="mock", model="mock", seed=123)

        output_a = asyncio.run(client_a.get_completion(messages, temperature=0.7))
        output_b = asyncio.run(client_b.get_completion(messages, temperature=0.7))

        assert output_a == output_b

    def test_mock_different_messages_produce_different_outputs(self):
        client = AIClient(provider="mock", model="mock", seed=123)
        output_a = asyncio.run(client.get_completion([{"role": "user", "content": "topic a"}], temperature=0.7))
        output_b = asyncio.run(client.get_completion([{"role": "user", "content": "topic b"}], temperature=0.7))
        assert output_a != output_b


class TestRetryWrapping:
    def test_completion_failure_raises_typed_exception(self):
        client = AIClient(provider="mock", model="mock", seed=123)

        async def broken_completion(*args, **kwargs):
            raise RuntimeError("boom")

        client._provider.get_completion = broken_completion

        with pytest.raises(AIClientException):
            asyncio.run(client.get_completion([{"role": "user", "content": "hi"}]))
