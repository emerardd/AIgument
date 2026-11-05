"""A failing model call must fail the run with a readable message, never become content."""

import asyncio
import json

import pytest

from exceptions import AIClientException
from models.session import Message, Session
from services.ai_client import AIClient, describe_failure


class AuthError(Exception):
    status_code = 401

    def __init__(self):
        super().__init__("Error code: 401 - Authentication Fails, Your api key: ****abcd is invalid")


class FailingProvider:
    calls = 0

    def __init__(self, *args, **kwargs):
        pass

    async def get_completion(self, *args, **kwargs):
        type(self).calls += 1
        raise AuthError()

    async def chat_stream(self, *args, **kwargs):
        type(self).calls += 1
        raise AuthError()
        yield ""  # pragma: no cover - makes this an async generator


@pytest.fixture
def failing_provider(monkeypatch):
    FailingProvider.calls = 0
    monkeypatch.setattr("services.ai_client.create_provider", lambda **kwargs: FailingProvider())
    return FailingProvider


def events_from_response(response):
    return [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")]


@pytest.mark.parametrize("exc,expected", [
    (AuthError(), "密钥"),
    (type("RateLimited", (Exception,), {"status_code": 429})("rate limit"), "额度"),
    (type("Missing", (Exception,), {"status_code": 404})("model_not_found"), "找不到模型 m"),
    (TimeoutError("timed out"), "超时"),
    (RuntimeError("boom"), "后端日志"),
])
def test_failure_messages_are_readable(exc, expected):
    message = describe_failure("deepseek", "m", exc)
    assert expected in message
    assert "abcd" not in message and "401" not in message


def test_auth_errors_are_not_retried(failing_provider):
    client = AIClient(provider="deepseek", model="m", api_key="x", retry_attempts=3, retry_delay=0)
    with pytest.raises(AIClientException) as info:
        asyncio.run(client.get_completion([{"role": "user", "content": "hi"}]))
    assert failing_provider.calls == 1
    assert "密钥" in str(info.value)


@pytest.mark.parametrize("path,params", [
    ("/api/debate/agent-stream", {"topic": "测试", "rounds": 1}),
    ("/api/dialectic/stream", {"topic": "测试", "rounds": 1}),
    ("/api/chat/dual-stream", {"topic": "测试", "turns": 1}),
    ("/api/qa/socratic-stream", {"question": "测试"}),
])
def test_failed_model_call_fails_the_run(client, db_session, failing_provider, path, params):
    events = events_from_response(client.get(path, params={**params, "provider": "mock", "model": "m"}))

    assert events[-1]["type"] == "error"
    assert "密钥" in events[-1]["error"]
    assert all(e["type"] != "complete" for e in events)

    session = db_session.query(Session).one()
    assert session.status == "failed"
    contents = [m.content for m in db_session.query(Message).all()]
    assert not any("生成失败" in c or "401" in c for c in contents)
