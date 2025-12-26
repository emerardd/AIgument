"""
辩论协调器 (Orchestrator)

作为"主持人"协调整个辩论流程：
- 管理 Agent 生命周期
- 控制辩论状态机
- 协调 Agent 间交互
- 提供流式输出接口
"""

from typing import Dict, Any, List, Optional, AsyncGenerator
from .base_agent import BaseAgent, ThinkResult
from .debater_agent import DebaterAgent
from .jury_agent import JuryAgent, RoundEvaluation, FinalVerdict
from .protocol import MessageBus, MessageTemplates, MessageType, AgentMessage
from memory.shared_memory import DebateMemory
import json
import asyncio


class DebateOrchestrator(BaseAgent):
    """辩论协调器
    
    状态机：
    not_started -> ready -> in_progress -> completed
    
    协调流程：
    1. 初始化 Agent
    2. 开场发言
    3. 多轮辩论（正方→反方→评分）
    4. 最终裁决
    """
    
    # 状态定义
    STATE_NOT_STARTED = "not_started"
    STATE_READY = "ready"
    STATE_IN_PROGRESS = "in_progress"
    STATE_COMPLETED = "completed"
    
    def __init__(self, ai_client):
        """初始化协调器
        
        Args:
            ai_client: AI 客户端实例
        """
        super().__init__(name="主持人", role="orchestrator", ai_client=ai_client)
        
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
    
    async def setup_debate(
        self, 
        topic: str, 
        total_rounds: int = 3,
        provider: str = "deepseek",
        model: str = "deepseek-chat"
    ) -> Dict[str, Any]:
        """初始化辩论
        
        Args:
            topic: 辩论主题
            total_rounds: 总轮次
            provider: AI 提供商
            model: 模型名称
            
        Returns:
            初始化状态
        """
        self.topic = topic
        self.total_rounds = total_rounds
        
        # 创建共享记忆
        self.memory_store = DebateMemory(topic=topic, total_rounds=total_rounds)
        
        # 创建辩论者 Agent
        self.pro_agent = DebaterAgent(
            name="正方",
            position="pro",
            ai_client=self.ai_client,
            topic=topic
        )
        
        self.con_agent = DebaterAgent(
            name="反方",
            position="con",
            ai_client=self.ai_client,
            topic=topic
        )
        
        # 创建评审 Agent
        self.jury_agent = JuryAgent(
            ai_client=self.ai_client,
            topic=topic
        )
        
        # 注册 Agent 到消息总线
        self.message_bus.subscribe("pro", lambda msg: print(f"[MessageBus] 正方收到: {msg.message_type.value}"))
        self.message_bus.subscribe("con", lambda msg: print(f"[MessageBus] 反方收到: {msg.message_type.value}"))
        self.message_bus.subscribe("jury", lambda msg: print(f"[MessageBus] 评审收到: {msg.message_type.value}"))
        self.message_bus.subscribe("orchestrator", lambda msg: print(f"[MessageBus] 主持人收到: {msg.message_type.value}"))
        
        # 发布辩论设置消息
        setup_msg = MessageTemplates.status(
            sender="orchestrator",
            status="debate_setup",
            details={"topic": topic, "rounds": total_rounds}
        )
        self.message_bus.publish(setup_msg)
        
        self.debate_state = self.STATE_READY
        
        self.add_to_memory({
            "type": "setup",
            "topic": topic,
            "total_rounds": total_rounds,
            "agents": ["pro", "con", "jury"]
        })
        
        return {
            "status": "ready",
            "topic": topic,
            "total_rounds": total_rounds,
            "agents": {
                "pro": self.pro_agent.get_stats(),
                "con": self.con_agent.get_stats(),
                "jury": "评审就位"
            }
        }
    
    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        """协调器的思考 - 决定下一步行动"""
        current_phase = context.get("phase", "unknown")
        
        return ThinkResult(
            reasoning=f"当前阶段: {current_phase}, 状态: {self.debate_state}",
            analysis={"phase": current_phase, "state": self.debate_state},
            next_action="coordinate",
            confidence=0.9
        )
    
    async def act(self, think_result: ThinkResult) -> str:
        """协调器的行动 - 执行协调"""
        return "协调辩论流程"
    
    async def run_debate(self) -> AsyncGenerator[Dict[str, Any], None]:
        """运行完整辩论（异步生成器）
        
        Yields:
            各种事件，包括：
            - type: opening/round_start/thinking/argument/evaluation/verdict/complete
        """
        print(f"[DEBUG] run_debate started, state={self.debate_state}")
        
        if self.debate_state != self.STATE_READY:
            print(f"[DEBUG] 辩论未就绪, 当前状态: {self.debate_state}")
            yield {"type": "error", "message": "辩论未就绪，请先调用 setup_debate"}
            return
        
        self.debate_state = self.STATE_IN_PROGRESS
        self.memory_store.start_debate()
        
        print(f"[DEBUG] 开始辩论，主题: {self.topic}")
        
        # 开场
        yield {
            "type": "opening",
            "content": f"欢迎来到本场辩论！今天的辩题是：**{self.topic}**",
            "topic": self.topic,
            "total_rounds": self.total_rounds
        }
        
        # 辩论上下文
        debate_context = {
            "topic": self.topic,
            "history": []
        }
        
        # 进行多轮辩论
        for round_num in range(1, self.total_rounds + 1):
            self.current_round = round_num
            self.memory_store.start_round(round_num)
            
            # 轮次开始
            yield {
                "type": "round_start",
                "round": round_num,
                "total_rounds": self.total_rounds
            }
            
            # === 正方发言 ===
            pro_context = {
                "round": round_num,
                "is_opening": round_num == 1 and len(debate_context["history"]) == 0,
                "opponent_last_argument": debate_context["history"][-1]["content"] if debate_context["history"] else "",
                "history": debate_context["history"]
            }
            
            print(f"[DEBUG] 第{round_num}轮 - 正方开始思考...")
            
            # 正方思考
            pro_think, pro_argument = await self.pro_agent.react(pro_context)
            print(f"[DEBUG] 正方思考完成，论点长度: {len(pro_argument)}")
            
            yield {
                "type": "thinking",
                "round": round_num,
                "side": "pro",
                "name": "正方",
                "content": pro_think.analysis,
                "confidence": pro_think.confidence
            }
            
            yield {
                "type": "argument",
                "round": round_num,
                "side": "pro",
                "name": "正方",
                "content": pro_argument
            }
            
            # 记录到共享记忆
            self.memory_store.add_argument(
                side="pro",
                agent_name="正方",
                content=pro_argument,
                thinking=pro_think.analysis
            )
            
            # 发布正方论点消息到消息总线
            pro_msg = MessageTemplates.argument(sender="pro", content=pro_argument, round=round_num)
            self.message_bus.publish(pro_msg)
            
            debate_context["history"].append({
                "round": round_num,
                "side": "pro",
                "content": pro_argument
            })
            
            # === 反方发言 ===
            con_context = {
                "round": round_num,
                "is_opening": round_num == 1,  # 第一轮双方都做开场发言，确保公平
                "opponent_last_argument": pro_argument,
                "history": debate_context["history"]
            }
            
            # 反方思考
            con_think, con_argument = await self.con_agent.react(con_context)
            
            yield {
                "type": "thinking",
                "round": round_num,
                "side": "con",
                "name": "反方",
                "content": con_think.analysis,
                "confidence": con_think.confidence
            }
            
            yield {
                "type": "argument",
                "round": round_num,
                "side": "con",
                "name": "反方",
                "content": con_argument
            }
            
            # 记录到共享记忆
            self.memory_store.add_argument(
                side="con",
                agent_name="反方",
                content=con_argument,
                thinking=con_think.analysis
            )
            
            # 发布反方论点消息到消息总线
            con_msg = MessageTemplates.argument(sender="con", content=con_argument, round=round_num)
            self.message_bus.publish(con_msg)
            
            debate_context["history"].append({
                "round": round_num,
                "side": "con",
                "content": con_argument
            })
            
            # === 评审评分 ===
            evaluation = await self.jury_agent.evaluate_round(
                pro_argument=pro_argument,
                con_argument=con_argument,
                round_num=round_num,
                history=[e for e in self.memory_store.evaluations]
            )
            
            eval_dict = evaluation.model_dump()
            self.memory_store.add_evaluation(eval_dict)
            
            # 发布评审消息到消息总线
            eval_msg = MessageTemplates.evaluation(
                sender="jury",
                receiver="",  # 广播
                scores={"pro": eval_dict["pro_score"], "con": eval_dict["con_score"]},
                commentary=evaluation.commentary,
                round=round_num
            )
            self.message_bus.publish(eval_msg)
            
            yield {
                "type": "evaluation",
                "round": round_num,
                "pro_score": eval_dict["pro_score"],
                "con_score": eval_dict["con_score"],
                "round_winner": evaluation.round_winner,
                "commentary": evaluation.commentary,
                "highlights": evaluation.highlights,
                "suggestions": evaluation.suggestions
            }
            
            self.memory_store.end_round(round_num)
            
            # 实时比分
            yield {
                "type": "standings",
                "round": round_num,
                "standings": self.memory_store.get_current_standings()
            }
        
        # === 最终裁决 ===
        verdict = await self.jury_agent.final_verdict()
        verdict_dict = verdict.model_dump()
        
        self.memory_store.complete_debate(verdict_dict)
        
        # 发布裁决消息到消息总线
        verdict_msg = MessageTemplates.verdict(
            sender="jury",
            winner=verdict.winner,
            pro_score=verdict.pro_total_score,
            con_score=verdict.con_total_score,
            summary=verdict.summary
        )
        self.message_bus.publish(verdict_msg)
        
        yield {
            "type": "verdict",
            "winner": verdict.winner,
            "pro_total_score": verdict.pro_total_score,
            "con_total_score": verdict.con_total_score,
            "margin": verdict.margin,
            "summary": verdict.summary,
            "pro_strengths": verdict.pro_strengths,
            "con_strengths": verdict.con_strengths,
            "key_turning_points": verdict.key_turning_points
        }
        
        self.debate_state = self.STATE_COMPLETED
        
        # 完成
        yield {
            "type": "complete",
            "message": "辩论结束",
            "final_state": self.memory_store.get_full_state(),
            "message_history": self.message_bus.export_history()  # 导出消息历史
        }
    
    async def run_debate_streaming(self) -> AsyncGenerator[Dict[str, Any], None]:
        """流式运行辩论（带流式论点输出）
        
        适用于 SSE 流式响应
        """
        if self.debate_state != self.STATE_READY:
            yield {"type": "error", "message": "辩论未就绪"}
            return
        
        self.debate_state = self.STATE_IN_PROGRESS
        self.memory_store.start_debate()
        
        # 开场
        yield {
            "type": "opening",
            "content": f"辩题：{self.topic}",
            "topic": self.topic,
            "total_rounds": self.total_rounds
        }
        
        debate_context = {"topic": self.topic, "history": []}
        
        for round_num in range(1, self.total_rounds + 1):
            self.current_round = round_num
            self.memory_store.start_round(round_num)
            
            yield {"type": "round_start", "round": round_num}
            
            # 正方上下文
            pro_context = {
                "round": round_num,
                "is_opening": round_num == 1,
                "opponent_last_argument": debate_context["history"][-1]["content"] if debate_context["history"] else "",
                "history": debate_context["history"]
            }
            
            # 正方流式输出
            pro_full_argument = ""
            async for event in self._stream_agent_react(self.pro_agent, pro_context):
                yield event
                if event.get("type") == "argument_complete":
                    pro_full_argument = event.get("content", "")
            
            self.memory_store.add_argument("pro", "正方", pro_full_argument)
            debate_context["history"].append({
                "round": round_num, "side": "pro", "content": pro_full_argument
            })
            
            # 反方上下文
            con_context = {
                "round": round_num,
                "is_opening": round_num == 1,  # 第一轮双方都做开场发言
                "opponent_last_argument": pro_full_argument,
                "history": debate_context["history"]
            }
            
            # 反方流式输出
            con_full_argument = ""
            async for event in self._stream_agent_react(self.con_agent, con_context):
                yield event
                if event.get("type") == "argument_complete":
                    con_full_argument = event.get("content", "")
            
            self.memory_store.add_argument("con", "反方", con_full_argument)
            debate_context["history"].append({
                "round": round_num, "side": "con", "content": con_full_argument
            })
            
            # 评审
            evaluation = await self.jury_agent.evaluate_round(
                pro_full_argument, con_full_argument, round_num
            )
            eval_dict = evaluation.model_dump()
            self.memory_store.add_evaluation(eval_dict)
            
            yield {
                "type": "evaluation",
                "round": round_num,
                **eval_dict
            }
            
            yield {
                "type": "standings",
                "standings": self.memory_store.get_current_standings()
            }
        
        # 最终裁决
        verdict = await self.jury_agent.final_verdict()
        self.memory_store.complete_debate(verdict.model_dump())
        
        yield {"type": "verdict", **verdict.model_dump()}
        
        self.debate_state = self.STATE_COMPLETED
        yield {"type": "complete"}
    
    async def _stream_agent_react(
        self, 
        agent: DebaterAgent, 
        context: Dict[str, Any]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式执行 Agent ReAct"""
        async for event in self._async_wrapper(agent.stream_react(context)):
            event["round"] = context.get("round", 1)
            yield event
    
    async def _async_wrapper(self, sync_generator):
        """将同步生成器包装为异步生成器"""
        for item in sync_generator:
            yield item
            await asyncio.sleep(0)  # 让出控制权
    
    def get_debate_state(self) -> Dict[str, Any]:
        """获取当前辩论状态"""
        return {
            "state": self.debate_state,
            "topic": self.topic,
            "total_rounds": self.total_rounds,
            "current_round": self.current_round,
            "standings": self.memory_store.get_current_standings() if self.memory_store else None,
            "agents": {
                "pro": self.pro_agent.get_stats() if self.pro_agent else None,
                "con": self.con_agent.get_stats() if self.con_agent else None,
            }
        }
    
    def get_transcript(self) -> str:
        """获取辩论记录"""
        if self.memory_store:
            return self.memory_store.export_transcript()
        return ""
    
    def get_full_state(self) -> Dict[str, Any]:
        """获取完整状态"""
        if self.memory_store:
            return self.memory_store.get_full_state()
        return {}
