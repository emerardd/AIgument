"""
辩论协调器 (Orchestrator)

作为"主持人"协调整个辩论流程：
- 管理 Agent 生命周期
- 控制辩论状态机
- 协调 Agent 间交互
- 提供流式输出接口
"""

from typing import Dict, Any, List, Optional, AsyncGenerator
from .base_agent import ThinkResult
from .debater_agent import DebaterAgent
from .jury_agent import JuryAgent, RoundEvaluation, FinalVerdict
from .protocol import MessageBus, MessageTemplates, MessageType, AgentMessage
from memory.shared_memory import DebateMemory
from config import RUN_CONFIG_PRESETS, MODEL_PRICING
from utils.costing import estimate_cost
from utils.logger import get_logger
import json
import asyncio


logger = get_logger(__name__)


class DebateOrchestrator:
    """辩论协调器

    状态机：
    not_started -> ready -> in_progress -> completed

    协调流程：
    1. 初始化 Agent
    2. 开场发言
    3. 多轮辩论（正方→反方→评分）
    4. 最终裁决
    """

    STATE_NOT_STARTED = "not_started"
    STATE_READY = "ready"
    STATE_IN_PROGRESS = "in_progress"
    STATE_COMPLETED = "completed"

    def __init__(self, ai_client):
        self.ai_client = ai_client
        self.memory: List[Dict[str, Any]] = []

        # Agent 引用
        self.pro_agent: Optional[DebaterAgent] = None
        self.con_agent: Optional[DebaterAgent] = None
        self.jury_agent: Optional[JuryAgent] = None

        # 共享记忆
        self.memory_store: Optional[DebateMemory] = None

        # 消息总线
        self.message_bus = MessageBus()

        # 状态
        self.debate_state = self.STATE_NOT_STARTED
        self.topic = ""
        self.total_rounds = 3
        self.current_round = 0
        self.run_config: Dict[str, Any] = {}

    def add_to_memory(self, event: Dict[str, Any]) -> None:
        from datetime import datetime
        event["timestamp"] = datetime.now().isoformat()
        self.memory.append(event)

    async def setup_debate(
        self,
        topic: str,
        total_rounds: int = 3,
        provider: str = "deepseek",
        model: str = "deepseek-chat",
        temperature: Optional[float] = None,
        seed: Optional[int] = None,
        preset: Optional[str] = None,
        pro_ai_client=None,
        con_ai_client=None,
    ) -> Dict[str, Any]:
        """初始化辩论"""
        self.topic = topic

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

        self.run_config = {
            "provider": provider,
            "model": model,
            "temperature": temperature,
            "seed": seed,
            "max_rounds": total_rounds,
            "preset": preset,
            "mixed_model": is_mixed,
        }

        if pro_ai_client is not None:
            self.run_config["pro_provider"] = getattr(pro_ai_client, "provider", "unknown")
            self.run_config["pro_model"] = getattr(pro_ai_client, "model", "unknown")
        if con_ai_client is not None:
            self.run_config["con_provider"] = getattr(con_ai_client, "provider", "unknown")
            self.run_config["con_model"] = getattr(con_ai_client, "model", "unknown")

        if hasattr(self.ai_client, "seed"):
            self.ai_client.seed = seed

        # 创建共享记忆
        self.memory_store = DebateMemory(topic=topic, total_rounds=total_rounds)
        self.memory_store.set_run_config(self.run_config)

        pro_client = pro_ai_client or self.ai_client
        con_client = con_ai_client or self.ai_client

        self.pro_agent = DebaterAgent(name="正方", position="pro", ai_client=pro_client, topic=topic, temperature=temperature)
        self.con_agent = DebaterAgent(name="反方", position="con", ai_client=con_client, topic=topic, temperature=temperature)
        self.jury_agent = JuryAgent(ai_client=self.ai_client, topic=topic, temperature=max(0.1, temperature - 0.2))

        # 注册到消息总线
        self.message_bus.subscribe("pro", lambda msg: logger.debug("[MessageBus] 正方收到: %s", msg.message_type.value))
        self.message_bus.subscribe("con", lambda msg: logger.debug("[MessageBus] 反方收到: %s", msg.message_type.value))
        self.message_bus.subscribe("jury", lambda msg: logger.debug("[MessageBus] 评审收到: %s", msg.message_type.value))
        self.message_bus.subscribe("orchestrator", lambda msg: logger.debug("[MessageBus] 主持人收到: %s", msg.message_type.value))

        setup_msg = MessageTemplates.status(
            sender="orchestrator",
            status="debate_setup",
            details={"topic": topic, "rounds": total_rounds, "run_config": self.run_config},
        )
        self.message_bus.publish(setup_msg)

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
        """流式运行辩论（SSE 响应的主入口）

        Yields 事件类型：
        - opening / round_start / thinking / argument / argument_complete
        - evaluation / standings / verdict / complete
        """
        if self.debate_state != self.STATE_READY:
            yield {"type": "error", "message": "辩论未就绪，请先调用 setup_debate"}
            return

        self.debate_state = self.STATE_IN_PROGRESS
        self.memory_store.start_debate()

        yield {"type": "opening", "content": f"辩题：{self.topic}", "topic": self.topic, "total_rounds": self.total_rounds}

        debate_context: Dict[str, Any] = {"topic": self.topic, "history": []}

        for round_num in range(1, self.total_rounds + 1):
            self.current_round = round_num
            self.memory_store.start_round(round_num)

            yield {"type": "round_start", "round": round_num, "total_rounds": self.total_rounds}

            # === 正方 ===
            pro_context = {
                "round": round_num,
                "is_opening": round_num == 1,
                "opponent_last_argument": debate_context["history"][-1]["content"] if debate_context["history"] else "",
                "history": debate_context["history"],
            }

            pro_full_argument = ""
            pro_thinking = None
            async for event in self._stream_agent_react(self.pro_agent, pro_context):
                if event.get("type") == "thinking":
                    pro_thinking = event.get("content")
                yield event
                if event.get("type") == "argument_complete":
                    pro_full_argument = event.get("content", "")

            self.memory_store.add_argument("pro", "正方", pro_full_argument, thinking=pro_thinking)
            pro_msg = MessageTemplates.argument(sender="pro", content=pro_full_argument, round=round_num)
            self.message_bus.publish(pro_msg)
            debate_context["history"].append({"round": round_num, "side": "pro", "content": pro_full_argument})

            # === 反方 ===
            con_context = {
                "round": round_num,
                "is_opening": round_num == 1,
                "opponent_last_argument": pro_full_argument,
                "history": debate_context["history"],
            }

            con_full_argument = ""
            con_thinking = None
            async for event in self._stream_agent_react(self.con_agent, con_context):
                if event.get("type") == "thinking":
                    con_thinking = event.get("content")
                yield event
                if event.get("type") == "argument_complete":
                    con_full_argument = event.get("content", "")

            self.memory_store.add_argument("con", "反方", con_full_argument, thinking=con_thinking)
            con_msg = MessageTemplates.argument(sender="con", content=con_full_argument, round=round_num)
            self.message_bus.publish(con_msg)
            debate_context["history"].append({"round": round_num, "side": "con", "content": con_full_argument})

            # === 评审 ===
            evaluation = await self.jury_agent.evaluate_round(pro_full_argument, con_full_argument, round_num)
            eval_dict = evaluation.model_dump()
            self.memory_store.add_evaluation(eval_dict)

            eval_msg = MessageTemplates.evaluation(
                sender="jury",
                receiver="",
                scores={"pro": eval_dict["pro_score"], "con": eval_dict["con_score"]},
                commentary=evaluation.commentary,
                round=round_num,
            )
            self.message_bus.publish(eval_msg)

            yield {"type": "evaluation", "round": round_num, **eval_dict}
            yield {"type": "standings", "standings": self.memory_store.get_current_standings()}

            self.memory_store.end_round(round_num)

        # === 最终裁决 ===
        verdict = await self.jury_agent.final_verdict()
        verdict_dict = verdict.model_dump()
        self.memory_store.set("verdict", verdict_dict)
        self.memory_store.complete_debate(verdict_dict)

        verdict_msg = MessageTemplates.verdict(
            sender="jury",
            winner=verdict.winner,
            pro_score=verdict.pro_total_score,
            con_score=verdict.con_total_score,
            summary=verdict.summary,
        )
        self.message_bus.publish(verdict_msg)

        yield {"type": "verdict", **verdict_dict}

        self.debate_state = self.STATE_COMPLETED
        yield {"type": "complete", "message_history": self.message_bus.export_history()}

    async def _stream_agent_react(
        self,
        agent: DebaterAgent,
        context: Dict[str, Any],
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式执行 Agent ReAct"""
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

        evaluations = self.memory_store.evaluations or []
        verdict = self.memory_store.get("verdict")

        def score_for_round(round_num: int, side: str) -> Optional[Dict[str, Any]]:
            eval_ = next((e for e in evaluations if e.get("round") == round_num), None)
            if not eval_:
                return None
            score = eval_.get(f"{side}_score")
            if isinstance(score, dict):
                total = sum(score.values())
                return {**score, "total": total}
            return {"total": score}

        turns = []
        for arg in self.memory_store.arguments:
            turns.append({
                "round": arg.round,
                "side": arg.side,
                "role": f"debater_{arg.side}",
                "thought": arg.thinking,
                "action": "argument",
                "result": arg.content,
                "score": score_for_round(arg.round, arg.side),
                "timestamp": arg.timestamp.isoformat(),
            })

        texts = [a.content for a in self.memory_store.arguments]
        for eval_ in evaluations:
            if eval_.get("commentary"):
                texts.append(eval_.get("commentary"))
        if verdict and verdict.get("summary"):
            texts.append(verdict.get("summary"))

        pricing = MODEL_PRICING.get(self.run_config.get("model"), MODEL_PRICING.get("mock", {}))
        cost = estimate_cost(texts, pricing)

        return {
            "topic": self.topic,
            "created_at": turns[0]["timestamp"] if turns else None,
            "run_config": self.run_config,
            "turns": turns,
            "evaluations": evaluations,
            "verdict": verdict,
            "standings": self.memory_store.get_current_standings(),
            "cost": cost,
            "message_history": self.message_bus.export_history(),
        }
