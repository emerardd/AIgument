"""
Dialectic engine orchestrator.
"""

from typing import Any, AsyncGenerator, Dict, List, Optional

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from memory.dialectic_memory import DialecticMemory

from .base_orchestrator import BaseOrchestrator
from .dialectic_debater import DialecticAntithesisAgent, DialecticThesisAgent
from .dialectic_observer import DialecticObserverAgent


class DialecticOrchestrator(BaseOrchestrator):
    def __init__(self, ai_client):
        super().__init__(ai_client)
        self.total_rounds: int = 5
        self.memory: Optional[DialecticMemory] = None
        self.thesis_agent: Optional[DialecticThesisAgent] = None
        self.antithesis_agent: Optional[DialecticAntithesisAgent] = None
        self.observer_agent: Optional[DialecticObserverAgent] = None

    async def setup(
        self,
        topic: str,
        total_rounds: int = 5,
        provider: str = DEFAULT_PROVIDER,
        model: str = DEFAULT_MODEL,
        temperature: Optional[float] = None,
        seed: Optional[int] = None
    ) -> Dict[str, Any]:
        if temperature is None:
            temperature = 0.7

        if hasattr(self.ai_client, "seed"):
            self.ai_client.seed = seed

        self.total_rounds = total_rounds
        self.configure_run(
            topic=topic,
            total_rounds=total_rounds,
            provider=provider,
            model=model,
            temperature=temperature,
            seed=seed,
        )

        self.memory = DialecticMemory(topic=topic, total_rounds=total_rounds)
        self.thesis_agent = DialecticThesisAgent(self.ai_client, temperature=temperature)
        self.antithesis_agent = DialecticAntithesisAgent(self.ai_client, temperature=temperature)
        self.observer_agent = DialecticObserverAgent(self.ai_client, temperature=max(0.2, temperature - 0.2))

        return {
            "status": "ready",
            "topic": topic,
            "total_rounds": total_rounds,
            "run_config": self.run_config,
        }

    async def run_stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        if not self.memory:
            yield {"type": "error", "message": "辩证法引擎未初始化"}
            return

        current_thesis = self.topic
        history: List[Dict[str, Any]] = []

        yield {"type": "opening", "topic": self.topic, "total_rounds": self.total_rounds}

        for round_num in range(1, self.total_rounds + 1):
            self.current_round = round_num
            yield {"type": "round_start", "round": round_num, "thesis": current_thesis}

            thesis_think, thesis_text = await self.thesis_agent.react({
                "round": round_num,
                "thesis": current_thesis,
                "history": history,
            })
            yield {
                "type": "thesis",
                "round": round_num,
                "side": "thesis",
                "content": thesis_text,
                "thinking": thesis_think.analysis,
            }

            antithesis_think, antithesis_text = await self.antithesis_agent.react({
                "round": round_num,
                "thesis": current_thesis,
                "thesis_argument": thesis_text,
            })
            yield {
                "type": "antithesis",
                "round": round_num,
                "side": "antithesis",
                "content": antithesis_text,
                "thinking": antithesis_think.analysis,
            }

            synthesis_result = await self.observer_agent.synthesize(
                thesis_text=thesis_text,
                antithesis_text=antithesis_text,
                round_num=round_num,
                history=history,
            )
            synthesis_text = synthesis_result.get("synthesis", "").strip() or "合题暂未生成，保持当前正题继续推进。"
            yield {
                "type": "synthesis",
                "round": round_num,
                "side": "synthesis",
                "content": synthesis_text,
                "thinking": {
                    "key_tensions": synthesis_result.get("key_tensions", []),
                    "confidence": synthesis_result.get("confidence", 0.5),
                },
            }

            fallacies = await self.observer_agent.detect_fallacies(thesis_text, antithesis_text)
            yield {"type": "fallacy", "round": round_num, "items": fallacies}

            self.memory.add_round(
                round_num=round_num,
                thesis=thesis_text,
                antithesis=antithesis_text,
                synthesis=synthesis_text,
                fallacies=fallacies,
            )

            tree = self.memory.build_tree()
            yield {"type": "tree_update", "round": round_num, "nodes": tree.get("nodes", []), "edges": tree.get("edges", [])}

            history.append({
                "round": round_num,
                "thesis": thesis_text,
                "antithesis": antithesis_text,
                "synthesis": synthesis_text,
            })
            current_thesis = synthesis_text or current_thesis

        yield {
            "type": "complete",
            "final_thesis": current_thesis,
            "trace": self.memory.build_trace(),
            "tree": self.memory.build_tree(),
        }

    def build_trace(self) -> Dict[str, Any]:
        if not self.memory:
            return {}
        trace = self.memory.build_trace()
        trace["run_config"] = self.run_config
        trace["final_thesis"] = trace["rounds"][-1]["synthesis"] if trace["rounds"] else None
        return trace
