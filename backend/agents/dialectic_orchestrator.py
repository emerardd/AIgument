"""
辩证法引擎协调器

控制正题-反题-合题的迭代流程，输出 SSE 事件。
"""
from typing import Dict, Any, AsyncGenerator, List, Optional

from .dialectic_debater import DialecticThesisAgent, DialecticAntithesisAgent
from .dialectic_observer import DialecticObserverAgent
from memory.dialectic_memory import DialecticMemory


class DialecticOrchestrator:
    def __init__(self, ai_client):
        self.ai_client = ai_client
        self.topic: str = ""
        self.total_rounds: int = 5
        self.current_round: int = 0
        self.memory: Optional[DialecticMemory] = None
        self.run_config: Dict[str, Any] = {}

        self.thesis_agent: Optional[DialecticThesisAgent] = None
        self.antithesis_agent: Optional[DialecticAntithesisAgent] = None
        self.observer_agent: Optional[DialecticObserverAgent] = None

    async def setup(
        self,
        topic: str,
        total_rounds: int = 5,
        provider: str = "deepseek",
        model: str = "deepseek-chat",
        temperature: Optional[float] = None,
        seed: Optional[int] = None
    ) -> Dict[str, Any]:
        self.topic = topic
        self.total_rounds = total_rounds

        if temperature is None:
            temperature = 0.7

        if hasattr(self.ai_client, "seed"):
            self.ai_client.seed = seed

        self.run_config = {
            "provider": provider,
            "model": model,
            "temperature": temperature,
            "seed": seed,
            "max_rounds": total_rounds
        }

        self.memory = DialecticMemory(topic=topic, total_rounds=total_rounds)

        self.thesis_agent = DialecticThesisAgent(self.ai_client, temperature=temperature)
        self.antithesis_agent = DialecticAntithesisAgent(self.ai_client, temperature=temperature)
        self.observer_agent = DialecticObserverAgent(self.ai_client, temperature=max(0.2, temperature - 0.2))

        return {
            "status": "ready",
            "topic": topic,
            "total_rounds": total_rounds,
            "run_config": self.run_config
        }

    async def run_stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        if not self.memory:
            yield {"type": "error", "message": "辩证法引擎未初始化"}
            return

        current_thesis = self.topic
        history: List[Dict[str, Any]] = []

        yield {
            "type": "opening",
            "topic": self.topic,
            "total_rounds": self.total_rounds
        }

        for round_num in range(1, self.total_rounds + 1):
            self.current_round = round_num
            yield {
                "type": "round_start",
                "round": round_num,
                "thesis": current_thesis
            }

            thesis_context = {
                "round": round_num,
                "thesis": current_thesis,
                "history": history
            }
            thesis_think, thesis_text = await self.thesis_agent.react(thesis_context)
            yield {
                "type": "thesis",
                "round": round_num,
                "side": "thesis",
                "content": thesis_text,
                "thinking": thesis_think.analysis
            }

            antithesis_context = {
                "round": round_num,
                "thesis": current_thesis,
                "thesis_argument": thesis_text
            }
            antithesis_think, antithesis_text = await self.antithesis_agent.react(antithesis_context)
            yield {
                "type": "antithesis",
                "round": round_num,
                "side": "antithesis",
                "content": antithesis_text,
                "thinking": antithesis_think.analysis
            }

            synthesis_result = await self.observer_agent.synthesize(
                thesis_text=thesis_text,
                antithesis_text=antithesis_text,
                round_num=round_num,
                history=history
            )
            synthesis_text = synthesis_result.get("synthesis", "").strip()
            if not synthesis_text:
                synthesis_text = "合题暂未生成，保持当前正题继续推进。"
            yield {
                "type": "synthesis",
                "round": round_num,
                "side": "synthesis",
                "content": synthesis_text,
                "thinking": {
                    "key_tensions": synthesis_result.get("key_tensions", []),
                    "confidence": synthesis_result.get("confidence", 0.5)
                }
            }

            fallacies = await self.observer_agent.detect_fallacies(thesis_text, antithesis_text)
            yield {
                "type": "fallacy",
                "round": round_num,
                "items": fallacies
            }

            self.memory.add_round(
                round_num=round_num,
                thesis=thesis_text,
                antithesis=antithesis_text,
                synthesis=synthesis_text,
                fallacies=fallacies
            )

            tree = self.memory.build_tree()
            yield {
                "type": "tree_update",
                "round": round_num,
                "nodes": tree.get("nodes", []),
                "edges": tree.get("edges", [])
            }

            history.append({
                "round": round_num,
                "thesis": thesis_text,
                "antithesis": antithesis_text,
                "synthesis": synthesis_text
            })

            current_thesis = synthesis_text or current_thesis

        yield {
            "type": "complete",
            "final_thesis": current_thesis,
            "trace": self.memory.build_trace(),
            "tree": self.memory.build_tree()
        }

    def build_trace(self) -> Dict[str, Any]:
        if not self.memory:
            return {}
        trace = self.memory.build_trace()
        trace["run_config"] = self.run_config
        trace["final_thesis"] = trace["rounds"][-1]["synthesis"] if trace["rounds"] else None
        return trace
