"""
Orchestrator trace tests.
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_client import AIClient
from agents.orchestrator import DebateOrchestrator


def test_build_trace_includes_verdict_streaming():
    async def _run():
        client = AIClient(provider="mock", model="mock", seed=123)
        orchestrator = DebateOrchestrator(ai_client=client)
        await orchestrator.setup_debate(
            topic="Test topic",
            total_rounds=1,
            provider="mock",
            model="mock",
            temperature=0.6,
            seed=123,
            preset=None
        )
        async for _ in orchestrator.run_debate_streaming():
            pass
        return orchestrator.build_trace()

    trace = asyncio.run(_run())
    assert trace.get("verdict") is not None
    assert trace.get("run_config") is not None
    assert trace["run_config"]["provider"] == "mock"
