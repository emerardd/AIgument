"""
辩论者 Agent

实现 ReAct 推理链的辩论者，具备：
- 分析对手论点弱点
- 选择反驳策略
- 生成结构化论点
- 维护辩论上下文
"""

from typing import Dict, Any, List, Optional
from .base_agent import BaseAgent, ThinkResult
import json


class DebaterAgent(BaseAgent):
    """辩论者 Agent
    
    使用 ReAct 模式进行辩论：
    1. 分析对手最新论点
    2. 识别论点薄弱环节
    3. 选择反驳策略
    4. 生成有力论点
    """
    
    # 可用的反驳策略
    STRATEGIES = {
        "direct_refute": "直接反驳 - 针对对方论点的核心逻辑进行反驳",
        "evidence_attack": "证据攻击 - 质疑对方论据的可靠性或相关性",
        "reframe": "重新定义 - 从不同角度重新定义问题框架",
        "counter_example": "反例论证 - 提供反例来否定对方论点",
        "consequence": "后果推演 - 分析对方立场的负面后果",
        "strengthen": "强化己方 - 提出新论据加强己方立场",
    }
    
    def __init__(
        self, 
        name: str, 
        position: str,  # "pro" 或 "con"
        ai_client,
        topic: str = ""
    ):
        """初始化辩论者 Agent
        
        Args:
            name: Agent 名称（如"正方"、"反方"）
            position: 立场（"pro" 正方 / "con" 反方）
            ai_client: AI 客户端实例
            topic: 辩论主题
        """
        super().__init__(name=name, role=f"debater_{position}", ai_client=ai_client)
        self.position = position
        self.position_label = "正方（支持方）" if position == "pro" else "反方（反对方）"
        self.topic = topic
        self.argument_history: List[str] = []
        self.opponent_arguments: List[str] = []
        
        # 初始化目标
        self.add_goal(f"作为{self.position_label}赢得辩论")
        self.add_goal("提出有力的论据支持己方立场")
        self.add_goal("有效反驳对方论点")
    
    def set_topic(self, topic: str) -> None:
        """设置辩论主题"""
        self.topic = topic
        self.update_belief("topic", topic)
    
    def _build_analysis_prompt(self, context: Dict[str, Any]) -> str:
        """构建分析提示词"""
        opponent_argument = context.get("opponent_last_argument", "")
        debate_history = context.get("history", [])
        round_num = context.get("round", 1)
        is_opening = context.get("is_opening", False)
        
        if is_opening:
            return f"""你是一个专业辩论选手，代表{self.position_label}。

【辩论主题】
{self.topic}

【任务】
这是辩论的开场。请分析这个辩题，制定你的开场策略。

请以 JSON 格式输出你的分析：
```json
{{
    "topic_analysis": "对辩题的理解和分析",
    "core_stance": "你的核心立场",
    "opening_strategy": "开场策略",
    "key_arguments": ["准备的核心论点1", "核心论点2", "核心论点3"],
    "anticipated_opposition": ["预期对方可能的论点"],
    "confidence": 0.8
}}
```"""
        
        # 历史摘要
        history_summary = ""
        if debate_history:
            history_summary = "\n".join([
                f"第{h.get('round', '?')}轮 - {h.get('side', '?')}: {h.get('content', '')[:100]}..."
                for h in debate_history[-4:]  # 最近4条
            ])
        
        return f"""你是一个专业辩论选手，代表{self.position_label}。

【辩论主题】
{self.topic}

【当前轮次】
第 {round_num} 轮

【对手最新论点】
{opponent_argument}

【辩论历史摘要】
{history_summary if history_summary else "无历史记录"}

【任务】
请分析对手的论点，找出薄弱环节，并制定反驳策略。

可选策略：
{chr(10).join([f"- {k}: {v}" for k, v in self.STRATEGIES.items()])}

请以 JSON 格式输出你的分析：
```json
{{
    "opponent_main_points": ["对手的主要论点"],
    "opponent_weaknesses": ["对手论点的薄弱环节"],
    "selected_strategy": "选择的策略名称",
    "strategy_reason": "选择该策略的理由",
    "counter_points": ["准备的反驳要点"],
    "new_arguments": ["新的己方论点"],
    "confidence": 0.7
}}
```"""
    
    def _build_generation_prompt(self, analysis: Dict[str, Any], context: Dict[str, Any]) -> str:
        """构建论点生成提示词"""
        is_opening = context.get("is_opening", False)
        round_num = context.get("round", 1)
        
        if is_opening:
            return f"""你是一个专业辩论选手，代表{self.position_label}。

【辩论主题】
{self.topic}

【你的分析】
{json.dumps(analysis, ensure_ascii=False, indent=2)}

【任务】
基于以上分析，生成你的开场发言。

【要求】
- 开门见山，亮明立场
- 提出 2-3 个核心论点
- 使用有说服力的论据
- 语言简洁有力
- 控制在 300-400 字

请直接输出你的发言内容，不要包含任何格式标记。"""
        
        return f"""你是一个专业辩论选手，代表{self.position_label}。

【辩论主题】
{self.topic}

【当前轮次】
第 {round_num} 轮

【你的策略分析】
{json.dumps(analysis, ensure_ascii=False, indent=2)}

【任务】
基于以上分析，生成你的回应发言。

【要求】
- 首先直接回应对方的论点
- 指出对方论点的问题
- 提出自己的反驳论据
- 可以适当提出新论点
- 保持逻辑连贯
- 语言简洁有力
- 控制在 300-400 字

请直接输出你的发言内容，不要包含任何格式标记。"""
    
    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        """推理过程 - 分析对手论点，制定策略
        
        Args:
            context: 包含 opponent_last_argument, history, round 等
            
        Returns:
            ThinkResult 包含分析结果
        """
        prompt = self._build_analysis_prompt(context)
        
        messages = [
            {"role": "system", "content": f"你是一个善于深度分析的辩论策略师，代表{self.position_label}。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self.ai_client.get_completion(messages, temperature=0.7)
            analysis = self._parse_json_response(response, {
                "opponent_weaknesses": [],
                "selected_strategy": "direct_refute",
                "counter_points": [],
                "confidence": 0.5
            })
            
            # 更新信念
            self.update_belief("last_analysis", analysis)
            self.update_belief("current_strategy", analysis.get("selected_strategy", "direct_refute"))
            
            # 记录到记忆
            self.add_to_memory({
                "type": "analysis",
                "round": context.get("round", 1),
                "analysis": analysis
            })
            
            return ThinkResult(
                reasoning=response,
                analysis=analysis,
                next_action="generate_argument",
                confidence=analysis.get("confidence", 0.5)
            )
            
        except Exception as e:
            print(f"[DebaterAgent] 思考过程出错: {e}")
            return ThinkResult(
                reasoning=f"分析失败: {str(e)}",
                analysis={},
                next_action="generate_argument",
                confidence=0.3
            )
    
    async def act(self, think_result: ThinkResult) -> str:
        """执行动作 - 生成辩论论点
        
        Args:
            think_result: 思考结果
            
        Returns:
            生成的论点文本
        """
        analysis = think_result.analysis
        context = self.get_belief("current_context", {})
        
        prompt = self._build_generation_prompt(analysis, context)
        
        messages = [
            {"role": "system", "content": f"你是一个口才出众的辩论选手，代表{self.position_label}。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self.ai_client.get_completion(messages, temperature=0.8)
            
            # 清理响应
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            
            # 记录论点
            self.argument_history.append(response)
            self.add_to_memory({
                "type": "argument",
                "round": context.get("round", 1),
                "content": response
            })
            
            return response
            
        except Exception as e:
            print(f"[DebaterAgent] 生成论点出错: {e}")
            return f"[{self.name}发言生成失败]"
    
    async def react(self, context: Dict[str, Any]) -> tuple[ThinkResult, str]:
        """完整的 ReAct 循环
        
        Args:
            context: 上下文信息，包含:
                - opponent_last_argument: 对手最新论点
                - history: 辩论历史
                - round: 当前轮次
                - is_opening: 是否为开场
        
        Returns:
            (思考结果, 生成的论点)
        """
        # 保存当前上下文
        self.update_belief("current_context", context)
        
        # 观察对手论点
        opponent_arg = context.get("opponent_last_argument", "")
        if opponent_arg:
            await self.observe(opponent_arg, source="opponent")
            self.opponent_arguments.append(opponent_arg)
        
        # 思考
        think_result = await self.think(context)
        
        # 行动
        argument = await self.act(think_result)
        
        return think_result, argument
    
    async def stream_react(self, context: Dict[str, Any]):
        """流式 ReAct 循环
        
        Yields:
            dict: {"type": "thinking"|"argument", "content": ...}
        """
        self.update_belief("current_context", context)
        
        # 观察
        opponent_arg = context.get("opponent_last_argument", "")
        if opponent_arg:
            await self.observe(opponent_arg, source="opponent")
            self.opponent_arguments.append(opponent_arg)
        
        # 思考阶段
        think_result = await self.think(context)
        yield {
            "type": "thinking",
            "side": self.position,
            "name": self.name,
            "content": think_result.analysis,
            "confidence": think_result.confidence
        }
        
        # 生成阶段 - 流式输出
        analysis = think_result.analysis
        prompt = self._build_generation_prompt(analysis, context)
        
        messages = [
            {"role": "system", "content": f"你是一个口才出众的辩论选手，代表{self.position_label}。"},
            {"role": "user", "content": prompt}
        ]
        
        full_response = ""
        try:
            for chunk in self.ai_client.chat_stream(messages, temperature=0.8):
                full_response += chunk
                yield {
                    "type": "argument",
                    "side": self.position,
                    "name": self.name,
                    "content": full_response,
                    "is_complete": False
                }
            
            # 记录完整论点
            self.argument_history.append(full_response)
            self.add_to_memory({
                "type": "argument",
                "round": context.get("round", 1),
                "content": full_response
            })
            
            yield {
                "type": "argument_complete",
                "side": self.position,
                "name": self.name,
                "content": full_response,
                "is_complete": True
            }
            
        except Exception as e:
            print(f"[DebaterAgent] 流式生成出错: {e}")
            yield {
                "type": "error",
                "side": self.position,
                "content": str(e)
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """获取辩论统计"""
        return {
            "name": self.name,
            "position": self.position,
            "topic": self.topic,
            "arguments_count": len(self.argument_history),
            "current_strategy": self.state.current_strategy,
            "beliefs": self.state.beliefs,
            "goals": self.state.goals
        }
