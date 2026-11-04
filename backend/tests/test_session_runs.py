"""Lifecycle coverage for dialectic, dual-chat and Socratic QA runs."""

import asyncio
import json

import pytest

from models.session import Message, Session
from repositories.session_run import SessionRunRepository
from schemas.session_runs import DialecticRequest, DualChatRequest, SocraticQARequest
from services.dialectic_run import DialecticRunService
from services.dual_chat_run import DualChatRunService
from services.socratic_run import SocraticRunService


def events_from_response(response):
    return [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")]


MODES = {
    "dialectic": (
        "/api/dialectic/stream",
        {"topic": "技术是否中立", "rounds": 1, "provider": "mock", "model": "mock"},
        DialecticRunService, DialecticRequest,
        # one finished message the stub emits before failing
        {"type": "thesis", "round": 1, "side": "thesis", "content": "正题内容"},
    ),
    "dual_chat": (
        "/api/chat/dual-stream",
        {"topic": "远程办公", "turns": 1, "provider": "mock", "model": "mock"},
        DualChatRunService, DualChatRequest,
        {"type": "message_complete", "speaker": "小阳", "role_id": "a", "content": "开场", "turn": 1},
    ),
    "qa_socratic": (
        "/api/qa/socratic-stream",
        {"question": "什么是熵", "mode": "structured", "provider": "mock", "model": "mock"},
        SocraticRunService, SocraticQARequest,
        {"type": "content", "content": "部分回答"},
    ),
}


def stub_events(monkeypatch, service_cls, first_event, ending):
    async def events(self, run):
        yield first_event
        if ending == "exception":
            raise RuntimeError("model failed")
        if ending == "error":
            yield {"type": "error", "error": "model failed"}
            return
        if ending == "cancel":
            raise asyncio.CancelledError()
        if ending == "complete":
            yield {"type": "complete", "content": "完整回答"}
        # "missing_complete": just stop

    monkeypatch.setattr(service_cls, "events", events)


@pytest.mark.parametrize("session_type", MODES)
def test_real_run_with_mock_provider_completes(client, db_session, session_type):
    path, params, *_ = MODES[session_type]
    response = client.get(path, params=params)
    assert response.status_code == 200
    events = events_from_response(response)
    assert events[0]["type"] == "session"
    assert events[-1]["type"] == "complete"

    session = db_session.query(Session).one()
    assert session.session_type == session_type
    assert session.settings["status"] == "completed"
    assert session.settings["completed_at"]
    assert db_session.query(Message).filter(Message.session_id == session.id).count() >= 2
    if session_type == "dialectic":
        assert session.settings["dialectic_tree"]["nodes"]
        assert session.settings["dialectic_trace"]["rounds"]


@pytest.mark.parametrize("ending", ["exception", "error", "missing_complete"])
@pytest.mark.parametrize("session_type", MODES)
def test_failure_marks_failed_and_keeps_finished_messages(client, db_session, monkeypatch, session_type, ending):
    path, params, service_cls, _, first_event = MODES[session_type]
    stub_events(monkeypatch, service_cls, first_event, ending)

    events = events_from_response(client.get(path, params=params))
    assert events[-1]["type"] == "error"
    assert all(event["type"] != "complete" for event in events)

    session = db_session.query(Session).one()
    assert session.settings["status"] == "failed"
    # dialectic/dual chat persist the finished turn; QA keeps the question
    assert db_session.query(Message).count() == 1


@pytest.mark.parametrize("cancel", ["close", "task"])
@pytest.mark.parametrize("session_type", MODES)
def test_cancelled_run_is_recorded(db_session, monkeypatch, session_type, cancel):
    _, params, service_cls, request_cls, first_event = MODES[session_type]
    stub_events(monkeypatch, service_cls, first_event, "cancel" if cancel == "task" else "complete")

    async def run():
        events = service_cls(SessionRunRepository(db_session)).run(request_cls(**params))
        await anext(events)  # session
        await anext(events)  # first event
        if cancel == "close":
            await events.aclose()
        else:
            with pytest.raises(asyncio.CancelledError):
                await anext(events)

    asyncio.run(run())
    assert db_session.query(Session).one().settings["status"] == "cancelled"


@pytest.mark.parametrize("session_type", MODES)
def test_complete_is_emitted_only_after_commit(db_session, monkeypatch, session_type):
    _, params, service_cls, request_cls, first_event = MODES[session_type]
    stub_events(monkeypatch, service_cls, first_event, "complete")

    async def run():
        async for event in service_cls(SessionRunRepository(db_session)).run(request_cls(**params)):
            if event["type"] == "complete":
                assert db_session.query(Session).one().settings["status"] == "completed"
                return
        pytest.fail("no complete event")

    asyncio.run(run())


@pytest.mark.parametrize("path,params", [
    ("/api/dialectic/stream", {"topic": "x", "rounds": 0, "provider": "mock"}),
    ("/api/dialectic/stream", {"topic": "x", "provider": "unknown"}),
    ("/api/chat/dual-stream", {"topic": "x", "turns": 0, "provider": "mock"}),
    ("/api/qa/socratic-stream", {"question": "x", "mode": "unknown", "provider": "mock"}),
    ("/api/qa/socratic-stream", {"question": "x", "history": "not json", "provider": "mock"}),
])
def test_invalid_parameters_rejected_before_creating_session(client, db_session, path, params):
    assert client.get(path, params=params).status_code == 422
    assert db_session.query(Session).count() == 0


def test_socratic_session_can_be_resumed(client, db_session):
    path, params, *_ = MODES["qa_socratic"]
    first = events_from_response(client.get(path, params=params))
    session_id = first[0]["session_id"]

    history = json.dumps([{"role": "user", "content": "什么是熵"}, {"role": "assistant", "content": "答案"}])
    second = events_from_response(client.get(path, params={
        **params, "question": "能举个例子吗", "session_id": session_id, "history": history,
    }))
    assert second[0]["session_id"] == session_id
    assert second[-1]["type"] == "complete"
    assert db_session.query(Session).count() == 1
    assert db_session.query(Message).count() == 4


@pytest.mark.parametrize("existing_type", [None, "dialectic"])
def test_socratic_resume_rejects_missing_or_foreign_session(client, db_session, existing_type):
    session_id = 999
    if existing_type:
        other = Session(session_type=existing_type, topic="x", settings={"status": "completed"})
        db_session.add(other)
        db_session.commit()
        session_id = other.id

    path, params, *_ = MODES["qa_socratic"]
    events = events_from_response(client.get(path, params={**params, "session_id": session_id}))
    assert events == [events[-1]] and events[-1]["type"] == "error"
    assert db_session.query(Message).count() == 0
    assert db_session.query(Session).count() == (1 if existing_type else 0)
