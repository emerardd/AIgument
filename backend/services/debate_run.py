"""One application workflow shared by streamed and collected debate endpoints."""

from contextlib import aclosing
from dataclasses import dataclass

from agents import DebateOrchestrator
from config import RUN_CONFIG_PRESETS
from repositories.debate import DebateRepository
from schemas.debate import DebateRequest
from services.session_run import SessionRunService


@dataclass
class DebateRun:
    orchestrator: DebateOrchestrator


class DebateRunService(SessionRunService[DebateRequest, DebateRepository]):
    label = "Debate run"

    async def prepare(self, request: DebateRequest) -> DebateRun:
        preset = RUN_CONFIG_PRESETS.get(request.preset, {})
        seed = request.seed if request.seed is not None else preset.get("seed")
        client = self.client(request.provider, request.model, seed)
        pro_client = self.client(request.pro_provider, request.pro_model, seed) if request.pro_provider else None
        con_client = self.client(request.con_provider, request.con_model, seed) if request.con_provider else None
        orchestrator = DebateOrchestrator(ai_client=client)
        await orchestrator.setup_debate(
            topic=request.topic, total_rounds=request.rounds,
            provider=request.provider, model=request.model,
            temperature=request.temperature, seed=seed, preset=request.preset,
            pro_ai_client=pro_client, con_ai_client=con_client,
        )
        return DebateRun(orchestrator)

    def open_session(self, request: DebateRequest, run: DebateRun):
        return self.repository.create(request.topic, {
            **run.orchestrator.run_config, "rounds": run.orchestrator.total_rounds,
        })

    def events(self, run: DebateRun):
        return run.orchestrator.run_debate_streaming()

    def persist(self, session, run: DebateRun, event: dict) -> None:
        if event.get("type") == "argument_complete":
            self.repository.save_argument(session, event)

    def finish(self, session, run: DebateRun, event: dict) -> None:
        orchestrator = run.orchestrator
        self.repository.complete_debate(
            session, orchestrator.build_trace(),
            orchestrator.get_full_state(), orchestrator.total_rounds,
        )

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
        record = self.repository.get_record(result["session_id"])
        result["rounds"] = record.total_rounds
        result["full_state"] = record.final_state
        return result
