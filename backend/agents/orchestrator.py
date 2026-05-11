"""
Debate orchestrator for the multi-agent flow.
"""

from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional

from config import DEFAULT_MODEL, DEFAULT_PROVIDER, RUN_CONFIG_PRESETS
from memory.shared_memory import DebateMemory
from utils.logger import get_logger

from .base_orchestrator import BaseOrchestrator
from .debater_agent import DebaterAgent
from .events import DebateEvent
from .jury_agent import JuryAgent
from .protocol import AgentMessage, MessageBus, MessageTemplates, MessageType


logger = get_logger(__name__)


class DebateOrchestrator(BaseOrchestrator):
    STATE_NOT_STARTED = "not_started"
    STATE_READY = "ready"
    STATE_IN_PROGRESS = "in_progress"
    STATE_COMPLETED = "completed"

    def __init__(self, ai_client):
        super().__init__(ai_client)
        self.memory: List[Dict[str, Any]] = []
        self.pro_agent: Optional[DebaterAgent] = None
        self.con_agent: Optional[DebaterAgent] = None
        self.jury_agent: Optional[JuryAgent] = None
        self.memory_store: Optional[DebateMemory] = None
        self.message_bus = MessageBus()
        self.event_log: List[DebateEvent] = []
        self.debate_state = self.STATE_NOT_STARTED
        self.total_rounds = 3

    def _record_event(self, event_type: str, *, transient: bool = False, **payload: Any) -> Dict[str, Any]:
        event = DebateEvent.from_payload(event_type, payload, transient=transient)
        if not transient:
            self.event_log.append(event)
        return event.to_stream_payload()

    def add_to_memory(self, event: Dict[str, Any]) -> None:
        event["timestamp"] = datetime.now().isoformat()
        self.memory.append(event)

    def _make_agent_handler(self, agent):
        def _handler(message: AgentMessage) -> None:
            logger.debug("[MessageBus] %s received %s", agent.name, message.message_type.value)
            agent.receive_message(message)
            normalized = message.to_dict().get("content", {})
            if message.message_type == MessageType.EVALUATION:
                agent.update_belief("latest_evaluation_commentary", normalized.get("result", ""))
                agent.update_belief("latest_evaluation_score", normalized.get("score"))
        return _handler

    async def setup_debate(
        self,
        topic: str,
        total_rounds: int = 3,
        provider: str = DEFAULT_PROVIDER,
        model: str = DEFAULT_MODEL,
        temperature: Optional[float] = None,
        seed: Optional[int] = None,
        preset: Optional[str] = None,
        pro_ai_client=None,
        con_ai_client=None,
    ) -> Dict[str, Any]:
        preset_config = RUN_CONFIG_PRESETS.get(preset, {}) if preset else {}
        if temperature is None:
            temperature = preset_config.get("temperature", 0.7)
        if seed is None:
            seed = preset_config.get("seed")
        max_rounds = preset_config.get("max_rounds")
        if max_rounds:
            total_rounds = min(total_rounds, max_rounds)
        self.total_rounds = total_rounds

        is_mixed = pro_ai_client is not None or con_ai_client is not None
        self.configure_run(
            topic=topic,
            total_rounds=total_rounds,
            provider=provider,
            model=model,
            temperature=temperature,
            seed=seed,
            preset=preset,
            mixed_model=is_mixed,
        )

        if pro_ai_client is not None:
            self.run_config["pro_provider"] = getattr(pro_ai_client, "provider", "unknown")
            self.run_config["pro_model"] = getattr(pro_ai_client, "model", "unknown")
        if con_ai_client is not None:
            self.run_config["con_provider"] = getattr(con_ai_client, "provider", "unknown")
            self.run_config["con_model"] = getattr(con_ai_client, "model", "unknown")

        if hasattr(self.ai_client, "seed"):
            self.ai_client.seed = seed

        self.event_log = []
        self.memory_store = DebateMemory(topic=topic, total_rounds=total_rounds)
        self.memory_store.set_run_config(self.run_config)

        pro_client = pro_ai_client or self.ai_client
        con_client = con_ai_client or self.ai_client
        self.pro_agent = DebaterAgent(name="正方", position="pro", ai_client=pro_client, topic=topic, temperature=temperature)
        self.con_agent = DebaterAgent(name="反方", position="con", ai_client=con_client, topic=topic, temperature=temperature)
        self.jury_agent = JuryAgent(ai_client=self.ai_client, topic=topic, temperature=max(0.1, temperature - 0.2))

        self.message_bus = MessageBus()
        self.message_bus.subscribe("pro", self._make_agent_handler(self.pro_agent))
        self.message_bus.subscribe("con", self._make_agent_handler(self.con_agent))
        self.message_bus.subscribe("jury", self._make_agent_handler(self.jury_agent))
        self.message_bus.subscribe("orchestrator", lambda msg: logger.debug("[MessageBus] orchestrator received %s", msg.message_type.value))

        self.message_bus.publish(
            MessageTemplates.status(
                sender="orchestrator",
                status="debate_setup",
                details={"topic": topic, "rounds": total_rounds, "run_config": self.run_config},
            )
        )

        self.debate_state = self.STATE_READY
        self.add_to_memory({"type": "setup", "topic": topic, "total_rounds": total_rounds, "agents": ["pro", "con", "jury"]})
        return {
            "status": "ready",
            "topic": topic,
            "total_rounds": total_rounds,
            "agents": {
                "pro": self.pro_agent.get_stats(),
                "con": self.con_agent.get_stats(),
                "jury": "评审就位",
            },
            "run_config": self.run_config,
        }

    async def run_debate_streaming(self) -> AsyncGenerator[Dict[str, Any], None]:
        if self.debate_state != self.STATE_READY:
            yield {"type": "error", "message": "辩论未就绪，请先调用 setup_debate"}
            return

        self.debate_state = self.STATE_IN_PROGRESS
        self.memory_store.start_debate()
        yield self._record_event(
            "opening",
            content=f"辩题：{self.topic}",
            topic=self.topic,
            total_rounds=self.total_rounds,
        )

        debate_context: Dict[str, Any] = {"topic": self.topic, "history": []}

        for round_num in range(1, self.total_rounds + 1):
            self.current_round = round_num
            self.memory_store.start_round(round_num)
            yield self._record_event("round_start", round=round_num, total_rounds=self.total_rounds)

            turn_order = ["pro", "con"] if round_num % 2 == 1 else ["con", "pro"]
            round_arguments: Dict[str, str] = {}
            round_thinking: Dict[str, Any] = {}

            for side in turn_order:
                agent = self.pro_agent if side == "pro" else self.con_agent
                label = "正方" if side == "pro" else "反方"
                context = {
                    "round": round_num,
                    "is_opening": round_num == 1 and side == turn_order[0],
                    "opponent_last_argument": debate_context["history"][-1]["content"] if debate_context["history"] else "",
                    "history": debate_context["history"],
                }
                full_argument = ""
                thinking = None
                async for event in self._stream_agent_react(agent, context):
                    if event.get("type") == "thinking":
                        thinking = event.get("content")
                    event_type = event.get("type", "")
                    payload = {key: value for key, value in event.items() if key != "type"}
                    yield self._record_event(event_type, transient=event_type == "argument", **payload)
                    if event.get("type") == "argument_complete":
                        full_argument = event.get("content", "")

                round_arguments[side] = full_argument
                round_thinking[side] = thinking
                self.memory_store.add_argument(side, label, full_argument, thinking=thinking)
                self.message_bus.publish(MessageTemplates.argument(sender=side, content=full_argument, round=round_num))
                debate_context["history"].append({"round": round_num, "side": side, "content": full_argument})

            evaluation = await self.jury_agent.evaluate_round(
                round_arguments.get("pro", ""),
                round_arguments.get("con", ""),
                round_num
            )
            eval_dict = evaluation.model_dump()
            self.memory_store.add_evaluation(eval_dict)
            self.message_bus.publish(
                MessageTemplates.evaluation(
                    sender="jury",
                    receiver="",
                    scores={"pro": eval_dict["pro_score"], "con": eval_dict["con_score"]},
                    commentary=evaluation.commentary,
                    round=round_num,
                )
            )

            yield self._record_event("evaluation", **eval_dict)
            yield self._record_event("standings", standings=self.memory_store.get_current_standings())
            self.memory_store.end_round(round_num)

        verdict = await self.jury_agent.final_verdict()
        verdict_dict = verdict.model_dump()
        self.memory_store.set("verdict", verdict_dict)
        self.memory_store.complete_debate(verdict_dict)
        self.message_bus.publish(
            MessageTemplates.verdict(
                sender="jury",
                winner=verdict.winner,
                pro_score=verdict.pro_total_score,
                con_score=verdict.con_total_score,
                summary=verdict.summary,
            )
        )
        yield self._record_event("verdict", **verdict_dict)

        self.debate_state = self.STATE_COMPLETED
        yield self._record_event("complete", message_history=self.message_bus.export_history())

    async def _stream_agent_react(
        self,
        agent: DebaterAgent,
        context: Dict[str, Any],
    ) -> AsyncGenerator[Dict[str, Any], None]:
        async for event in agent.stream_react(context):
            event["round"] = context.get("round", 1)
            yield event

    def get_debate_state(self) -> Dict[str, Any]:
        return {
            "state": self.debate_state,
            "topic": self.topic,
            "total_rounds": self.total_rounds,
            "current_round": self.current_round,
            "standings": self.memory_store.get_current_standings() if self.memory_store else None,
            "agents": {
                "pro": self.pro_agent.get_stats() if self.pro_agent else None,
                "con": self.con_agent.get_stats() if self.con_agent else None,
            },
        }

    def get_transcript(self) -> str:
        return self.memory_store.export_transcript() if self.memory_store else ""

    def get_full_state(self) -> Dict[str, Any]:
        return self.memory_store.get_full_state() if self.memory_store else {}

    def build_trace(self) -> Dict[str, Any]:
        if not self.memory_store:
            return {}

        durable_events = [event for event in self.event_log if not event.transient]
        evaluations = [
            event.payload
            for event in durable_events
            if event.type == "evaluation"
        ]
        verdict_event = next((event for event in durable_events if event.type == "verdict"), None)
        verdict = verdict_event.payload if verdict_event else self.memory_store.get("verdict")
        standings_event = next(
            (event for event in reversed(durable_events) if event.type == "standings"),
            None,
        )
        standings = standings_event.payload.get("standings") if standings_event else self.memory_store.get_current_standings()

        thinking_by_turn = {
            (event.round, event.side): event.payload.get("content")
            for event in durable_events
            if event.type == "thinking"
        }

        def score_for_round(round_num: int, side: str) -> Optional[Dict[str, Any]]:
            evaluation = next((item for item in evaluations if item.get("round") == round_num), None)
            if not evaluation:
                return None
            score = evaluation.get(f"{side}_score")
            if isinstance(score, dict):
                total = sum(score.values())
                return {**score, "total": total}
            return {"total": score}

        turns = []
        for event in durable_events:
            if event.type != "argument_complete":
                continue
            side = event.side or event.payload.get("side")
            round_num = event.round or event.payload.get("round")
            turns.append({
                "round": round_num,
                "side": side,
                "role": f"debater_{side}",
                "thought": thinking_by_turn.get((round_num, side)),
                "action": "argument",
                "result": event.payload.get("content", ""),
                "score": score_for_round(round_num, side),
                "timestamp": event.timestamp.isoformat(),
            })

        return {
            "topic": self.topic,
            "created_at": turns[0]["timestamp"] if turns else None,
            "run_config": self.run_config,
            "events": [event.to_trace_dict() for event in durable_events],
            "turns": turns,
            "evaluations": evaluations,
            "verdict": verdict,
            "standings": standings,
            "message_history": self.message_bus.export_history(),
        }
