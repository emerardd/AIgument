"""
Dialectic orchestrator tests.
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_client import AIClient
from agents.dialectic_orchestrator import DialecticOrchestrator


def _run_orchestrator(rounds: int):
    async def _inner():
        client = AIClient(provider="mock", model="mock", seed=123)
        orchestrator = DialecticOrchestrator(ai_client=client)
        await orchestrator.setup(
            topic="测试主题",
            total_rounds=rounds,
            provider="mock",
            model="mock",
            temperature=0.6,
            seed=123
        )
        events = []
        async for event in orchestrator.run_stream():
            events.append(event)
        return orchestrator, events

    return asyncio.run(_inner())


def test_dialectic_orchestrator_one_round():
    orchestrator, events = _run_orchestrator(1)
    types = [e.get("type") for e in events]
    assert types[0] == "opening"
    assert "round_start" in types
    assert "thesis" in types
    assert "antithesis" in types
    assert "synthesis" in types
    assert "fallacy" in types
    assert "tree_update" in types
    assert types[-1] == "complete"
    trace = orchestrator.build_trace()
    assert trace.get("total_rounds") == 1
    assert len(trace.get("rounds", [])) == 1


def test_dialectic_orchestrator_five_rounds():
    _, events = _run_orchestrator(5)
    round_starts = [e for e in events if e.get("type") == "round_start"]
    tree_updates = [e for e in events if e.get("type") == "tree_update"]
    assert len(round_starts) == 5
    assert len(tree_updates) == 5
