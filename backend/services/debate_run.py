"""One application workflow shared by streamed and collected debate endpoints."""

import asyncio
from contextlib import aclosing
from typing import AsyncIterator

from agents import DebateOrchestrator
from config import RUN_CONFIG_PRESETS
from repositories.debate import DebateRepository
from schemas.debate import DebateRequest
from services.ai_client import AIClient
from utils import get_api_key
from utils.logger import get_logger

logger = get_logger(__name__)


class DebateRunService:
    def __init__(self, repository: DebateRepository):
        self.repository = repository

    @staticmethod
    def _client(provider: str, model: str, seed: int | None) -> AIClient:
        return AIClient(provider=provider, model=model, api_key=get_api_key(provider), seed=seed)

    async def run(self, request: DebateRequest) -> AsyncIterator[dict]:
        session = None
        completed = False
        terminated = False
        try:
            preset = RUN_CONFIG_PRESETS.get(request.preset, {})
            seed = request.seed if request.seed is not None else preset.get("seed")
            client = self._client(request.provider, request.model, seed)
            pro_client = self._client(request.pro_provider, request.pro_model, seed) if request.pro_provider else None
            con_client = self._client(request.con_provider, request.con_model, seed) if request.con_provider else None
            orchestrator = DebateOrchestrator(ai_client=client)
            await orchestrator.setup_debate(
                topic=request.topic, total_rounds=request.rounds,
                provider=request.provider, model=request.model,
                temperature=request.temperature, seed=seed, preset=request.preset,
                pro_ai_client=pro_client, con_ai_client=con_client,
            )
            session = self.repository.create(request.topic, {
                **orchestrator.run_config, "rounds": orchestrator.total_rounds,
            })
            yield {"type": "session", "session_id": session.id}

            async with aclosing(orchestrator.run_debate_streaming()) as events:
                async for event in events:
                    event_type = event.get("type")
                    if event_type == "error":
                        raise RuntimeError(event.get("error") or event.get("message") or "Debate failed")
                    if event_type == "argument_complete":
                        self.repository.save_argument(session, event)
                    if event_type == "complete":
                        self.repository.complete(
                            session, orchestrator.build_trace(),
                            orchestrator.get_full_state(), orchestrator.total_rounds,
                        )
                        completed = True
                        yield event
                        return
                    yield event
            raise RuntimeError("Debate ended without a completion event")
        except (asyncio.CancelledError, GeneratorExit):
            raise
        except Exception as exc:
            if session is not None:
                terminated = True
                self._terminate(session, "failed", str(exc))
            else:
                self.repository.rollback()
            logger.exception("Debate run failed")
            raise
        finally:
            if session is not None and not completed and not terminated:
                self._terminate(session, "cancelled")

    def _terminate(self, session, status: str, error: str | None = None) -> None:
        try:
            self.repository.terminate(session, status, error)
        except Exception:
            self.repository.rollback()
            logger.exception("Unable to persist debate termination: %s", status)

    async def collect(self, request: DebateRequest) -> dict:
        result = {"topic": request.topic, "arguments": [], "thinkings": [], "evaluations": [], "verdict": None}
        fields = {"argument_complete": "arguments", "thinking": "thinkings", "evaluation": "evaluations"}
        async with aclosing(self.run(request)) as events:
            async for event in events:
                event_type = event.get("type")
                if event_type == "session":
                    result["session_id"] = event["session_id"]
                elif event_type in fields:
                    result[fields[event_type]].append(event)
                elif event_type == "verdict":
                    result["verdict"] = event
        # Read the same committed state returned by history and analysis APIs.
        session = self.repository.get(result["session_id"])
        result["rounds"] = session.settings["rounds"]
        result["full_state"] = session.settings["final_state"]
        return result
