"""
辩证法辩手 Agents

提供正题与反题的生成：
- DialecticThesisAgent: 维护并强化当前正题
- DialecticAntithesisAgent: 提出反题并攻击正题
"""
from typing import Dict, Any, List
import json

from .base_agent import BaseAgent, ThinkResult


class DialecticThesisAgent(BaseAgent):
    """正题 Agent"""

    def __init__(self, ai_client, temperature: float = 0.7):
        super().__init__(name="正题", role="dialectic_thesis", ai_client=ai_client)
        self.temperature = temperature
        self.add_goal("维护并强化当前正题")
        self.add_goal("用清晰有力的论证阐明立场")

    def _build_analysis_prompt(self, thesis: str, round_num: int, history: List[Dict[str, Any]]) -> str:
        history_summary = ""
        if history:
            history_summary = "\n".join(
                [f"第{h['round']}轮合题: {h['synthesis'][:80]}..." for h in history[-3:]]
            )
        return f"""你是“正题”辩手，任务是阐明并强化当前正题。

【当前正题】
{thesis}

【轮次】
第 {round_num} 轮

【历史合题摘要】
{history_summary if history_summary else "无"}

请输出 JSON 分析：
```json
{{
  "core_thesis": "正题的核心主张",
  "supporting_points": ["支持点1","支持点2","支持点3"],
  "assumptions": ["关键前提1","关键前提2"],
  "confidence": 0.7
}}
```"""

    def _build_generation_prompt(self, analysis: Dict[str, Any], thesis: str, round_num: int) -> str:
        return f"""你是“正题”辩手，请基于分析输出一段正题论证。

【当前正题】
{thesis}

【分析】
{json.dumps(analysis, ensure_ascii=False, indent=2)}

【要求】
- 200-300 字
- 逻辑清晰、论点聚焦
- 提出 2-3 个支撑论据
- 语言简洁有力

请直接输出正文，不要附加格式标记。"""

    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        thesis = context.get("thesis", "")
        round_num = context.get("round", 1)
        history = context.get("history", [])

        prompt = self._build_analysis_prompt(thesis, round_num, history)
        messages = [
            {"role": "system", "content": "你是一名思维严谨的哲学辩手，专注于阐明正题。"},
            {"role": "user", "content": prompt},
        ]

        try:
            response = self.ai_client.get_completion(messages, temperature=self.temperature)
            analysis = self._parse_json_response(response, {
                "core_thesis": thesis,
                "supporting_points": [],
                "assumptions": [],
                "confidence": 0.5
            })
            return ThinkResult(
                reasoning=response,
                analysis=analysis,
                next_action="generate_thesis",
                confidence=analysis.get("confidence", 0.5)
            )
        except Exception as e:
            return ThinkResult(
                reasoning=f"分析失败: {str(e)}",
                analysis={"core_thesis": thesis},
                next_action="generate_thesis",
                confidence=0.3
            )

    async def act(self, think_result: ThinkResult) -> str:
        analysis = think_result.analysis
        context = self.get_belief("current_context", {})
        thesis = context.get("thesis", "")
        round_num = context.get("round", 1)

        prompt = self._build_generation_prompt(analysis, thesis, round_num)
        messages = [
            {"role": "system", "content": "你是一名擅长论证的哲学辩手，表达凝练有力。"},
            {"role": "user", "content": prompt},
        ]
        try:
            response = self.ai_client.get_completion(messages, temperature=self.temperature)
            return response.strip()
        except Exception as e:
            return f"[正题生成失败: {str(e)}]"

    async def react(self, context: Dict[str, Any]) -> tuple[ThinkResult, str]:
        self.update_belief("current_context", context)
        think_result = await self.think(context)
        argument = await self.act(think_result)
        return think_result, argument


class DialecticAntithesisAgent(BaseAgent):
    """反题 Agent"""

    def __init__(self, ai_client, temperature: float = 0.7):
        super().__init__(name="反题", role="dialectic_antithesis", ai_client=ai_client)
        self.temperature = temperature
        self.add_goal("提出明确的反题并构建否定性论证")
        self.add_goal("指出正题的关键漏洞与隐含前提")

    def _build_analysis_prompt(self, thesis: str, thesis_argument: str, round_num: int) -> str:
        return f"""你是“反题”辩手，任务是提出对当前正题的否定或对立立场。

【当前正题】
{thesis}

【正题论证】
{thesis_argument}

【轮次】
第 {round_num} 轮

请输出 JSON 分析：
```json
{{
  "antithesis": "清晰的反题表述",
  "attack_points": ["攻击点1","攻击点2","攻击点3"],
  "hidden_assumptions": ["正题隐含前提1","前提2"],
  "confidence": 0.7
}}
```"""

    def _build_generation_prompt(self, analysis: Dict[str, Any], round_num: int) -> str:
        return f"""你是“反题”辩手，请基于分析输出反题论证。

【分析】
{json.dumps(analysis, ensure_ascii=False, indent=2)}

【要求】
- 200-300 字
- 明确提出反题
- 针对正题论证进行反驳
- 结构清晰、力度集中

请直接输出正文，不要附加格式标记。"""

    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        thesis = context.get("thesis", "")
        thesis_argument = context.get("thesis_argument", "")
        round_num = context.get("round", 1)

        prompt = self._build_analysis_prompt(thesis, thesis_argument, round_num)
        messages = [
            {"role": "system", "content": "你是一名批判性极强的哲学辩手，专注于提出反题。"},
            {"role": "user", "content": prompt},
        ]

        try:
            response = self.ai_client.get_completion(messages, temperature=self.temperature)
            analysis = self._parse_json_response(response, {
                "antithesis": "",
                "attack_points": [],
                "hidden_assumptions": [],
                "confidence": 0.5
            })
            return ThinkResult(
                reasoning=response,
                analysis=analysis,
                next_action="generate_antithesis",
                confidence=analysis.get("confidence", 0.5)
            )
        except Exception as e:
            return ThinkResult(
                reasoning=f"分析失败: {str(e)}",
                analysis={"antithesis": ""},
                next_action="generate_antithesis",
                confidence=0.3
            )

    async def act(self, think_result: ThinkResult) -> str:
        analysis = think_result.analysis
        context = self.get_belief("current_context", {})
        round_num = context.get("round", 1)

        prompt = self._build_generation_prompt(analysis, round_num)
        messages = [
            {"role": "system", "content": "你是一名善于反驳的哲学辩手，表达锋利、逻辑清晰。"},
            {"role": "user", "content": prompt},
        ]
        try:
            response = self.ai_client.get_completion(messages, temperature=self.temperature)
            return response.strip()
        except Exception as e:
            return f"[反题生成失败: {str(e)}]"

    async def react(self, context: Dict[str, Any]) -> tuple[ThinkResult, str]:
        self.update_belief("current_context", context)
        think_result = await self.think(context)
        argument = await self.act(think_result)
        return think_result, argument
