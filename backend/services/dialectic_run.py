"""Dialectic engine run: thesis, antithesis and synthesis persisted per round."""

from dataclasses import dataclass, field

from agents import DialecticOrchestrator
from config import RUN_CONFIG_PRESETS
from repositories.session_run import SessionRunRepository
from schemas.session_runs import DialecticRequest
from services.session_run import SessionRunService

ROLE_LABELS = {"thesis": "正题", "antithesis": "反题", "synthesis": "合题"}


@dataclass
class DialecticRun:
    orchestrator: DialecticOrchestrator
    settings: dict
    tree: dict | None = field(default=None)


class DialecticRunService(SessionRunService[DialecticRequest, SessionRunRepository]):
    label = "Dialectic run"

    async def prepare(self, request: DialecticRequest) -> DialecticRun:
        preset = RUN_CONFIG_PRESETS.get(request.preset, {})
        seed = request.seed if request.seed is not None else preset.get("seed")
        temperature = request.temperature if request.temperature is not None else preset.get("temperature")
        orchestrator = DialecticOrchestrator(ai_client=self.client(request.provider, request.model, seed))
        await orchestrator.setup(
            topic=request.topic, total_rounds=request.rounds,
            provider=request.provider, model=request.model,
            temperature=temperature, seed=seed,
        )
        settings = {
            "rounds": request.rounds, "provider": request.provider, "model": request.model,
            "temperature": temperature, "seed": seed, "preset": request.preset, "mode": "dialectic",
        }
        return DialecticRun(orchestrator, settings)

    def open_session(self, request: DialecticRequest, run: DialecticRun):
        return self.repository.start("dialectic", request.topic, run.settings)

    def events(self, run: DialecticRun):
        return run.orchestrator.run_stream()

    def persist(self, session, run: DialecticRun, event: dict) -> None:
        event_type = event.get("type")
        if event_type in ROLE_LABELS:
            self.repository.add_message(
                session, ROLE_LABELS[event_type], event.get("content") or "",
                {"round": event.get("round"), "side": event.get("side"), "mode": "dialectic"},
            )
        elif event_type == "tree_update":
            run.tree = {"nodes": event.get("nodes", []), "edges": event.get("edges", [])}

    def finish(self, session, run: DialecticRun, event: dict) -> None:
        tree = event.get("tree") or run.tree
        self.repository.complete(session, result={
            "trace": run.orchestrator.build_trace(),
            "tree": tree,
        })
