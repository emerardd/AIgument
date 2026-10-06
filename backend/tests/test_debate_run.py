"""Regression coverage for the shared workflow and its transaction boundaries."""

import asyncio
import json

import pytest

from models.debate_record import DebateRecord
from models.session import Message, Session
from repositories.debate import DebateRepository
from schemas.debate import DebateRequest
from services.debate_run import DebateRunService


@pytest.fixture
def orchestrator(monkeypatch):
    class StubOrchestrator:
        failure = None
        clients = None

        def __init__(self, ai_client):
            self.ai_client = ai_client

        async def setup_debate(self, **kwargs):
            self.total_rounds = kwargs["total_rounds"]
            self.run_config = {key: kwargs[key] for key in ("provider", "model", "seed", "temperature", "preset")}
            pro = kwargs["pro_ai_client"]
            con = kwargs["con_ai_client"]
            type(self).clients = (self.ai_client, pro, con)
            self.run_config["mixed_model"] = bool(pro or con)
            for side, client in (("pro", pro), ("con", con)):
                if client:
                    self.run_config[f"{side}_provider"] = client.provider
                    self.run_config[f"{side}_model"] = client.model

        async def run_debate_streaming(self):
            yield {"type": "argument_complete", "name": "正方", "side": "pro", "round": 1, "content": "完整论点"}
            if self.failure == "exception":
                raise RuntimeError("model failed")
            if self.failure == "error":
                yield {"type": "error", "message": "model failed"}
                return
            if self.failure == "missing_complete":
                return
            if self.failure == "cancel":
                raise asyncio.CancelledError()
            yield {"type": "verdict", "winner": "pro"}
            yield {"type": "complete", "message_history": []}

        def build_trace(self):
            return {"run_config": self.run_config, "verdict": {"winner": "pro"}, "evaluations": []}

        def get_full_state(self):
            return {"state": "completed"}

    monkeypatch.setattr("services.debate_run.DebateOrchestrator", StubOrchestrator)
    return StubOrchestrator


def request(**kwargs):
    return DebateRequest(topic="测试辩题", provider="mock", model="mock", rounds=1, **kwargs)


def events_from_response(response):
    return [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")]


@pytest.mark.parametrize("transport", ["stream", "post"])
def test_both_transports_persist_analysis(client, db_session, orchestrator, transport):
    params = request(pro_provider="mock", pro_model="pro-model", con_provider="mock", con_model="con-model").model_dump(exclude_none=True)
    if transport == "stream":
        response = client.get("/api/debate/agent-stream", params=params)
        assert events_from_response(response)[-1]["type"] == "complete"
    else:
        response = client.post("/api/debate/agent", json=params)
        assert response.json()["full_state"] == {"state": "completed"}
        assert response.json()["arguments"][0]["content"] == "完整论点"
    assert response.status_code == 200
    session = db_session.query(Session).one()
    assert session.settings["status"] == "completed"
    record = db_session.query(DebateRecord).one()
    assert record.completed_at is not None
    assert record.pro_model == "pro-model"
    assert record.con_model == "con-model"
    assert record.is_mixed == 1
    assert db_session.query(Message).one().content == "完整论点"
    assert client.get(f"/api/analysis/debate/{session.id}").status_code == 200


def test_complete_is_visible_only_after_commit(db_session, orchestrator):
    async def run():
        service = DebateRunService(DebateRepository(db_session))
        async for event in service.run(request()):
            if event["type"] == "complete":
                assert db_session.query(Session).one().settings["status"] == "completed"
                assert db_session.query(DebateRecord).count() == 1
    asyncio.run(run())


@pytest.mark.parametrize("failure", ["exception", "error", "missing_complete"])
@pytest.mark.parametrize("transport", ["stream", "post"])
def test_failure_preserves_completed_turns(client, db_session, orchestrator, failure, transport):
    orchestrator.failure = failure
    if transport == "stream":
        response = client.get("/api/debate/agent-stream", params=request().model_dump(exclude_none=True))
        events = events_from_response(response)
        assert events[-1]["type"] == "error"
        assert all(event["type"] != "complete" for event in events)
    else:
        response = client.post("/api/debate/agent", json=request().model_dump())
        assert response.status_code == 500
    assert db_session.query(Session).one().settings["status"] == "failed"
    assert db_session.query(Message).count() == 1
    assert db_session.query(DebateRecord).count() == 0


@pytest.mark.parametrize("cancel", ["close", "task"])
def test_cancelled_run_is_recorded(db_session, orchestrator, cancel):
    async def run():
        service = DebateRunService(DebateRepository(db_session))
        events = service.run(request())
        await anext(events)  # session
        await anext(events)  # persisted argument
        if cancel == "close":
            await events.aclose()
        else:
            orchestrator.failure = "cancel"
            with pytest.raises(asyncio.CancelledError):
                await anext(events)
    asyncio.run(run())
    assert db_session.query(Session).one().settings["status"] == "cancelled"
    assert db_session.query(Message).count() == 1
    assert db_session.query(DebateRecord).count() == 0


def test_final_commit_failure_does_not_emit_complete(client, db_session, orchestrator, monkeypatch):
    original_commit = db_session.commit

    def fail_final_commit():
        if any(isinstance(item, DebateRecord) for item in db_session.new):
            raise RuntimeError("disk full")
        original_commit()

    monkeypatch.setattr(db_session, "commit", fail_final_commit)
    response = client.get("/api/debate/agent-stream", params=request().model_dump(exclude_none=True))
    events = events_from_response(response)
    assert events[-1] == {"type": "error", "error": "disk full"}
    assert all(event["type"] != "complete" for event in events)
    assert db_session.query(Session).one().settings["status"] == "failed"
    assert db_session.query(DebateRecord).count() == 0
    assert db_session.query(Message).count() == 1


def test_preset_seed_reaches_every_provider(db_session, orchestrator):
    asyncio.run(DebateRunService(DebateRepository(db_session)).collect(request(
        preset="basic", pro_provider="mock", pro_model="pro", con_provider="mock", con_model="con",
    )))
    assert all(client._provider.seed == 42 for client in orchestrator.clients)


@pytest.mark.parametrize("transport", ["stream", "post"])
def test_real_orchestrator_with_mock_provider(client, db_session, transport):
    data = request(seed=123, pro_provider="mock", pro_model="pro-model").model_dump(exclude_none=True)
    if transport == "stream":
        response = client.get("/api/debate/agent-stream", params=data)
        assert events_from_response(response)[-1]["type"] == "complete"
    else:
        response = client.post("/api/debate/agent", json=data)
        assert len(response.json()["arguments"]) == 2
    assert response.status_code == 200
    record = db_session.query(DebateRecord).one()
    assert record.trace["verdict"] is not None
    assert len(record.trace["turns"]) == 2
    assert record.pro_model == "pro-model"
    assert record.con_model == "mock"
    assert record.is_mixed == 1
    assert db_session.query(Message).count() == 2


@pytest.mark.parametrize("transport", ["stream", "post"])
@pytest.mark.parametrize("params", [{"pro_provider": "mock"}, {"con_model": "model"}, {"pro_provider": "mock", "pro_model": " "}, {"temperature": 2}, {"provider": "unknown"}])
def test_invalid_configuration_rejected_before_creating_session(client, db_session, transport, params):
    data = {**request().model_dump(exclude_none=True), **params}
    if transport == "stream":
        response = client.get("/api/debate/agent-stream", params=data)
    else:
        response = client.post("/api/debate/agent", json=data)
    assert response.status_code == 422
    assert db_session.query(Session).count() == 0
