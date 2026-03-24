"""
Jury agent for round scoring and final verdicts.
"""

import json
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .base_agent import BaseAgent, ThinkResult
from utils.logger import get_logger


logger = get_logger(__name__)


class RoundScore(BaseModel):
    logic: float = Field(ge=0, le=10)
    evidence: float = Field(ge=0, le=10)
    rhetoric: float = Field(ge=0, le=10)
    rebuttal: float = Field(ge=0, le=10)

    @property
    def total(self) -> float:
        return self.logic + self.evidence + self.rhetoric + self.rebuttal

    @property
    def average(self) -> float:
        return self.total / 4


class RoundEvaluation(BaseModel):
    round: int
    pro_score: RoundScore
    con_score: RoundScore
    round_winner: str
    commentary: str
    highlights: List[str] = Field(default_factory=list)
    suggestions: Dict[str, List[str]] = Field(default_factory=dict)
    is_fallback: bool = False
    error_message: Optional[str] = None


class FinalVerdict(BaseModel):
    winner: str
    pro_total_score: float
    con_total_score: float
    margin: str
    summary: str
    pro_strengths: List[str]
    con_strengths: List[str]
    key_turning_points: List[str]
    is_fallback: bool = False
    error_message: Optional[str] = None


class JuryAgent(BaseAgent):
    SCORING_CRITERIA = {
        "logic": "论证是否清晰、有条理、无明显矛盾",
        "evidence": "论据是否充分、可信、相关",
        "rhetoric": "表达是否准确、有说服力",
        "rebuttal": "对对方论点的回应是否有效",
    }

    def __init__(self, ai_client, topic: str = "", temperature: float = 0.5):
        super().__init__(name="评审", role="jury", ai_client=ai_client)
        self.topic = topic
        self.temperature = temperature
        self.evaluations: List[RoundEvaluation] = []
        self.pro_scores: List[RoundScore] = []
        self.con_scores: List[RoundScore] = []
        self.add_goal("公平客观地评估辩论")
        self.add_goal("提供建设性的反馈")

    def set_topic(self, topic: str) -> None:
        self.topic = topic
        self.update_belief("topic", topic)

    def _build_evaluation_prompt(
        self,
        pro_argument: str,
        con_argument: str,
        round_num: int,
        history: List[Dict] = None
    ) -> str:
        history_context = ""
        if history:
            lines = [f"- 第{h.get('round')}轮 {h.get('round_winner', 'tie')}获胜" for h in history[-2:]]
            history_context = "\n【历史表现】\n" + "\n".join(lines)

        return f"""你是一位经验丰富的辩论赛评审，请公正评估第 {round_num} 轮辩论。

【辩论主题】
{self.topic}

【正方发言】
{pro_argument}

【反方发言】
{con_argument}
{history_context}

【评分标准】
{chr(10).join([f"- {k}: {v}" for k, v in self.SCORING_CRITERIA.items()])}

请以 JSON 输出：
```json
{{
  "pro_score": {{"logic": 0, "evidence": 0, "rhetoric": 0, "rebuttal": 0}},
  "con_score": {{"logic": 0, "evidence": 0, "rhetoric": 0, "rebuttal": 0}},
  "round_winner": "pro",
  "commentary": "简短点评",
  "highlights": ["亮点"],
  "suggestions": {{"pro": ["建议"], "con": ["建议"]}}
}}
```"""

    def _build_verdict_prompt(self, all_evaluations: List[Dict]) -> str:
        rounds_summary = ""
        pro_total = 0
        con_total = 0

        for evaluation in all_evaluations:
            round_num = evaluation.get("round", "?")
            pro_score = evaluation.get("pro_score", {})
            con_score = evaluation.get("con_score", {})
            winner = evaluation.get("round_winner", "tie")
            pro_round = sum(pro_score.values()) if isinstance(pro_score, dict) else 0
            con_round = sum(con_score.values()) if isinstance(con_score, dict) else 0
            pro_total += pro_round
            con_total += con_round
            rounds_summary += f"第{round_num}轮: 正方{pro_round} vs 反方{con_round} ({winner})\n"

        return f"""你是辩论赛的终审评委，请根据各轮评分给出最终裁决。

【辩题】
{self.topic}

【各轮比分】
{rounds_summary}

【累计得分】
正方: {pro_total}
反方: {con_total}

【详细评分】
{json.dumps(all_evaluations, ensure_ascii=False, indent=2)}

请以 JSON 输出：
```json
{{
  "winner": "pro",
  "pro_total_score": {pro_total},
  "con_total_score": {con_total},
  "margin": "close",
  "summary": "最终裁决理由",
  "pro_strengths": ["优点"],
  "con_strengths": ["优点"],
  "key_turning_points": ["关键转折点"]
}}
```"""

    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        task = context.get("task", "evaluate_round")
        if task == "evaluate_round":
            return ThinkResult(
                reasoning="准备评估本轮辩论",
                analysis={"task": "evaluate_round"},
                next_action="evaluate",
                confidence=0.9,
            )
        if task == "final_verdict":
            return ThinkResult(
                reasoning="准备给出最终裁决",
                analysis={"task": "final_verdict"},
                next_action="verdict",
                confidence=0.9,
            )
        return ThinkResult(reasoning="未知任务", analysis={}, next_action="none", confidence=0.0)

    async def act(self, think_result: ThinkResult) -> str:
        return ""

    async def evaluate_round(
        self,
        pro_argument: str,
        con_argument: str,
        round_num: int,
        history: List[Dict] = None
    ) -> RoundEvaluation:
        prompt = self._build_evaluation_prompt(pro_argument, con_argument, round_num, history)
        messages = [
            {"role": "system", "content": "你是一位公正、专业的辩论评审。"},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await self.ai_client.get_completion(messages, temperature=self.temperature)
            result = self._parse_json_response(response, {
                "pro_score": {"logic": 0, "evidence": 0, "rhetoric": 0, "rebuttal": 0},
                "con_score": {"logic": 0, "evidence": 0, "rhetoric": 0, "rebuttal": 0},
                "round_winner": "tie",
                "commentary": "评估结果解析失败",
                "highlights": [],
                "suggestions": {"pro": [], "con": []},
            })

            evaluation = RoundEvaluation(
                round=round_num,
                pro_score=RoundScore(**result.get("pro_score", {})),
                con_score=RoundScore(**result.get("con_score", {})),
                round_winner=result.get("round_winner", "tie"),
                commentary=result.get("commentary", ""),
                highlights=result.get("highlights", []),
                suggestions=result.get("suggestions", {}),
            )

            self.evaluations.append(evaluation)
            self.pro_scores.append(evaluation.pro_score)
            self.con_scores.append(evaluation.con_score)
            self.add_to_memory({"type": "evaluation", "round": round_num, "result": evaluation.model_dump()})
            return evaluation
        except Exception as exc:
            logger.exception("JuryAgent 评估出错")
            return RoundEvaluation(
                round=round_num,
                pro_score=RoundScore(logic=0, evidence=0, rhetoric=0, rebuttal=0),
                con_score=RoundScore(logic=0, evidence=0, rhetoric=0, rebuttal=0),
                round_winner="tie",
                commentary=f"评估过程出错: {exc}",
                highlights=[],
                suggestions={},
                is_fallback=True,
                error_message=str(exc),
            )

    async def final_verdict(self) -> FinalVerdict:
        if not self.evaluations:
            return FinalVerdict(
                winner="tie",
                pro_total_score=0,
                con_total_score=0,
                margin="marginal",
                summary="没有可用的评估记录",
                pro_strengths=[],
                con_strengths=[],
                key_turning_points=[],
                is_fallback=True,
                error_message="No evaluations available",
            )

        all_evaluations = [
            {
                "round": evaluation.round,
                "pro_score": evaluation.pro_score.model_dump(),
                "con_score": evaluation.con_score.model_dump(),
                "round_winner": evaluation.round_winner,
                "commentary": evaluation.commentary,
                "is_fallback": evaluation.is_fallback,
            }
            for evaluation in self.evaluations
        ]
        prompt = self._build_verdict_prompt(all_evaluations)
        messages = [
            {"role": "system", "content": "你是辩论赛的终审评委，请给出公正的最终裁决。"},
            {"role": "user", "content": prompt},
        ]

        pro_total = sum(score.total for score in self.pro_scores)
        con_total = sum(score.total for score in self.con_scores)

        try:
            response = await self.ai_client.get_completion(messages, temperature=self.temperature)
            result = self._parse_json_response(response, {})
            verdict = FinalVerdict(
                winner=result.get("winner", "pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie")),
                pro_total_score=pro_total,
                con_total_score=con_total,
                margin=result.get("margin", "close"),
                summary=result.get("summary", ""),
                pro_strengths=result.get("pro_strengths", []),
                con_strengths=result.get("con_strengths", []),
                key_turning_points=result.get("key_turning_points", []),
            )
            self.update_belief("final_verdict", verdict.model_dump())
            return verdict
        except Exception as exc:
            logger.exception("JuryAgent 最终裁决出错")
            return FinalVerdict(
                winner="pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie"),
                pro_total_score=pro_total,
                con_total_score=con_total,
                margin="close",
                summary=f"裁决过程出错: {exc}",
                pro_strengths=[],
                con_strengths=[],
                key_turning_points=[],
                is_fallback=True,
                error_message=str(exc),
            )

    def get_current_standings(self) -> Dict[str, Any]:
        pro_total = sum(score.total for score in self.pro_scores)
        con_total = sum(score.total for score in self.con_scores)
        pro_wins = sum(1 for evaluation in self.evaluations if evaluation.round_winner == "pro")
        con_wins = sum(1 for evaluation in self.evaluations if evaluation.round_winner == "con")
        ties = sum(1 for evaluation in self.evaluations if evaluation.round_winner == "tie")
        return {
            "rounds_completed": len(self.evaluations),
            "pro_total_score": pro_total,
            "con_total_score": con_total,
            "pro_round_wins": pro_wins,
            "con_round_wins": con_wins,
            "ties": ties,
            "leader": "pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie"),
        }

    def reset(self) -> None:
        self.evaluations = []
        self.pro_scores = []
        self.con_scores = []
        self.memory = []
        self.state.beliefs = {}
