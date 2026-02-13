"""
辩证法观察者 Agent

负责生成合题与检测逻辑谬误。
"""
from typing import Dict, Any, List

from .base_agent import BaseAgent, ThinkResult


class DialecticObserverAgent(BaseAgent):
    """观察者/记录员 Agent"""

    def __init__(self, ai_client, temperature: float = 0.5):
        super().__init__(name="观察者", role="dialectic_observer", ai_client=ai_client)
        self.temperature = temperature
        self.add_goal("提炼正反观点的张力与共识，生成更高层次的合题")
        self.add_goal("检测并标注论证中的常见逻辑谬误")

    def _build_synthesis_prompt(
        self,
        thesis_text: str,
        antithesis_text: str,
        round_num: int,
        history: List[Dict[str, Any]]
    ) -> str:
        history_summary = ""
        if history:
            history_summary = "\n".join(
                [f"第{h['round']}轮合题: {h['synthesis'][:80]}..." for h in history[-3:]]
            )
        return f"""你是“观察者/记录员”，请综合正题与反题形成合题。

【正题】
{thesis_text}

【反题】
{antithesis_text}

【轮次】
第 {round_num} 轮

【历史合题摘要】
{history_summary if history_summary else "无"}

请输出 JSON：
```json
{{
  "synthesis": "更高层次的合题，需吸收双方合理部分",
  "key_tensions": ["张力点1","张力点2"],
  "confidence": 0.7
}}
```"""

    def _build_fallacy_prompt(self, thesis_text: str, antithesis_text: str) -> str:
        return f"""请检测以下两段论证中的逻辑谬误（如稻草人、滑坡、诉诸权威等）。

【正题论证】
{thesis_text}

【反题论证】
{antithesis_text}

请以 JSON 数组输出，每个元素包含：
type: 谬误类型
quote: 触发谬误的片段（不超过30字）
explanation: 简要解释（不超过40字）
severity: "low"|"medium"|"high"
side: "thesis" 或 "antithesis"

输出示例：
```json
[
  {{
    "type": "稻草人谬误",
    "quote": "……",
    "explanation": "歪曲了对方观点",
    "severity": "medium",
    "side": "antithesis"
  }}
]
```"""

    async def synthesize(
        self,
        thesis_text: str,
        antithesis_text: str,
        round_num: int,
        history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        prompt = self._build_synthesis_prompt(thesis_text, antithesis_text, round_num, history)
        messages = [
            {"role": "system", "content": "你是具有哲学整合能力的观察者，擅长提出合题。"},
            {"role": "user", "content": prompt},
        ]
        try:
            response = self.ai_client.get_completion(messages, temperature=self.temperature)
            result = self._parse_json_response(response, {
                "synthesis": "",
                "key_tensions": [],
                "confidence": 0.5
            })
            if not result.get("synthesis"):
                result["synthesis"] = "在正反张力中，需要在目标与边界之间取得动态平衡。"
            return result
        except Exception:
            return {
                "synthesis": "在正反张力中，需要在目标与边界之间取得动态平衡。",
                "key_tensions": [],
                "confidence": 0.4
            }

    async def detect_fallacies(self, thesis_text: str, antithesis_text: str) -> List[Dict[str, Any]]:
        prompt = self._build_fallacy_prompt(thesis_text, antithesis_text)
        messages = [
            {"role": "system", "content": "你是逻辑分析专家，擅长识别论证谬误。"},
            {"role": "user", "content": prompt},
        ]
        try:
            response = self.ai_client.get_completion(messages, temperature=0.3)
            parsed = self._parse_json_response(response, default=[])
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return []

    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        task = context.get("task", "synthesize")
        return ThinkResult(
            reasoning=f"执行观察者任务: {task}",
            analysis={"task": task},
            next_action=task,
            confidence=0.6
        )

    async def act(self, think_result: ThinkResult) -> str:
        return ""
