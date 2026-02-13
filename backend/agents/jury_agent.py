"""
评审 Agent

作为独立第三方评估辩论质量，具备：
- 评估单轮辩论的各项指标
- 给出结构化评分
- 提供点评和改进建议
- 最终裁决胜负
"""

from typing import Dict, Any, List, Optional
from .base_agent import BaseAgent, ThinkResult
from pydantic import BaseModel, Field
import json


class RoundScore(BaseModel):
    """单轮评分"""
    logic: int = Field(ge=1, le=10, description="逻辑性评分 1-10")
    evidence: int = Field(ge=1, le=10, description="论据质量 1-10")
    rhetoric: int = Field(ge=1, le=10, description="修辞表达 1-10")
    rebuttal: int = Field(ge=1, le=10, description="反驳有效性 1-10")
    
    @property
    def total(self) -> int:
        return self.logic + self.evidence + self.rhetoric + self.rebuttal
    
    @property
    def average(self) -> float:
        return self.total / 4


class RoundEvaluation(BaseModel):
    """单轮评估结果"""
    round: int = Field(description="轮次")
    pro_score: RoundScore = Field(description="正方评分")
    con_score: RoundScore = Field(description="反方评分")
    round_winner: str = Field(description="本轮胜者: pro/con/tie")
    commentary: str = Field(description="评审点评")
    highlights: List[str] = Field(default_factory=list, description="精彩亮点")
    suggestions: Dict[str, List[str]] = Field(default_factory=dict, description="给双方的建议")


class FinalVerdict(BaseModel):
    """最终裁决"""
    winner: str = Field(description="胜者: pro/con/tie")
    pro_total_score: int = Field(description="正方总分")
    con_total_score: int = Field(description="反方总分")
    margin: str = Field(description="胜负差距: decisive/close/marginal")
    summary: str = Field(description="裁决理由总结")
    pro_strengths: List[str] = Field(description="正方优势")
    con_strengths: List[str] = Field(description="反方优势")
    key_turning_points: List[str] = Field(description="关键转折点")


class JuryAgent(BaseAgent):
    """评审 Agent
    
    作为独立第三方评估辩论，提供：
    - 专业的评分标准
    - 结构化的评估结果
    - 公正的裁决
    """
    
    # 评分维度说明
    SCORING_CRITERIA = {
        "logic": "逻辑性 - 论证是否清晰、有条理、无矛盾",
        "evidence": "论据质量 - 论据是否充分、可信、相关",
        "rhetoric": "修辞表达 - 语言是否有感染力、表达是否精准",
        "rebuttal": "反驳有效性 - 对对方论点的回应是否有力",
    }
    
    def __init__(self, ai_client, topic: str = "", temperature: float = 0.5):
        """初始化评审 Agent
        
        Args:
            ai_client: AI 客户端实例
            topic: 辩论主题
        """
        super().__init__(name="评审", role="jury", ai_client=ai_client)
        self.topic = topic
        self.temperature = temperature
        self.evaluations: List[RoundEvaluation] = []
        self.pro_scores: List[RoundScore] = []
        self.con_scores: List[RoundScore] = []
        
        # 设置目标
        self.add_goal("公正客观地评估辩论")
        self.add_goal("提供建设性的反馈")
    
    def set_topic(self, topic: str) -> None:
        """设置辩论主题"""
        self.topic = topic
        self.update_belief("topic", topic)
    
    def _build_evaluation_prompt(
        self, 
        pro_argument: str, 
        con_argument: str, 
        round_num: int,
        history: List[Dict] = None
    ) -> str:
        """构建评估提示词"""
        history_context = ""
        if history:
            history_context = "\n【历史表现】\n"
            for h in history[-2:]:
                history_context += f"- 第{h.get('round')}轮: {h.get('round_winner', 'tie')}获胜\n"
        
        return f"""你是一位经验丰富的辩论赛评审，请公正评估第 {round_num} 轮辩论。

【辩论主题】
{self.topic}

【正方发言】
{pro_argument}

【反方发言】
{con_argument}
{history_context}
【评分标准说明】
{chr(10).join([f"- {k}: {v}" for k, v in self.SCORING_CRITERIA.items()])}

请根据以上标准，以 JSON 格式给出你的评估：
```json
{{
    "pro_score": {{
        "logic": 1-10,
        "evidence": 1-10,
        "rhetoric": 1-10,
        "rebuttal": 1-10
    }},
    "con_score": {{
        "logic": 1-10,
        "evidence": 1-10,
        "rhetoric": 1-10,
        "rebuttal": 1-10
    }},
    "round_winner": "pro" 或 "con" 或 "tie",
    "commentary": "对本轮辩论的专业点评，100字以内",
    "highlights": ["本轮的精彩亮点，如有"],
    "suggestions": {{
        "pro": ["给正方的建议"],
        "con": ["给反方的建议"]
    }}
}}
```

【重要公平性提示】
- 请确保评分公正客观，基于辩论表现而非个人立场
- 后发言者天然在反驳方面有信息优势，评分时应考虑这一因素
- 评估反驳有效性时，应同时考虑论点的原创性和建设性
- 避免系统性偏向任何一方，双方应有平等的获胜机会"""
    
    def _build_verdict_prompt(self, all_evaluations: List[Dict]) -> str:
        """构建最终裁决提示词"""
        rounds_summary = ""
        pro_total = 0
        con_total = 0
        
        for eval_ in all_evaluations:
            round_num = eval_.get("round", "?")
            pro_s = eval_.get("pro_score", {})
            con_s = eval_.get("con_score", {})
            winner = eval_.get("round_winner", "tie")
            
            pro_round = sum(pro_s.values()) if isinstance(pro_s, dict) else 0
            con_round = sum(con_s.values()) if isinstance(con_s, dict) else 0
            pro_total += pro_round
            con_total += con_round
            
            rounds_summary += f"第{round_num}轮: 正方{pro_round}分 vs 反方{con_round}分 ({winner}胜)\n"
        
        return f"""你是辩论赛的终审评委，请根据各轮评分给出最终裁决。

【辩论主题】
{self.topic}

【各轮比分】
{rounds_summary}

【累计得分】
正方总分: {pro_total}
反方总分: {con_total}

【各轮详细评价】
{json.dumps(all_evaluations, ensure_ascii=False, indent=2)}

请给出你的最终裁决，以 JSON 格式：
```json
{{
    "winner": "pro" 或 "con" 或 "tie",
    "pro_total_score": {pro_total},
    "con_total_score": {con_total},
    "margin": "decisive"(压倒性胜利>15%) 或 "close"(接近5-15%) 或 "marginal"(微弱<5%),
    "summary": "最终裁决理由，200字以内",
    "pro_strengths": ["正方的主要优势"],
    "con_strengths": ["反方的主要优势"],
    "key_turning_points": ["影响胜负的关键时刻"]
}}
```"""
    
    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        """评审的思考过程 - 评估辩论"""
        task = context.get("task", "evaluate_round")
        
        if task == "evaluate_round":
            return ThinkResult(
                reasoning="准备评估本轮辩论",
                analysis={"task": "evaluate_round"},
                next_action="evaluate",
                confidence=0.9
            )
        elif task == "final_verdict":
            return ThinkResult(
                reasoning="准备给出最终裁决",
                analysis={"task": "final_verdict"},
                next_action="verdict",
                confidence=0.9
            )
        
        return ThinkResult(
            reasoning="未知任务",
            analysis={},
            next_action="none",
            confidence=0.0
        )
    
    async def act(self, think_result: ThinkResult) -> str:
        """评审的行动 - 输出评估结果"""
        # 由 evaluate_round 和 final_verdict 直接处理
        return ""
    
    async def evaluate_round(
        self, 
        pro_argument: str, 
        con_argument: str, 
        round_num: int,
        history: List[Dict] = None
    ) -> RoundEvaluation:
        """评估单轮辩论
        
        Args:
            pro_argument: 正方论点
            con_argument: 反方论点
            round_num: 轮次
            history: 历史评估记录
            
        Returns:
            RoundEvaluation 评估结果
        """
        prompt = self._build_evaluation_prompt(pro_argument, con_argument, round_num, history)
        
        messages = [
            {"role": "system", "content": "你是一位公正、专业的辩论赛评审，擅长给出客观的评价。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self.ai_client.get_completion(messages, temperature=self.temperature)
            result = self._parse_json_response(response, {
                "pro_score": {"logic": 5, "evidence": 5, "rhetoric": 5, "rebuttal": 5},
                "con_score": {"logic": 5, "evidence": 5, "rhetoric": 5, "rebuttal": 5},
                "round_winner": "tie",
                "commentary": "评估失败",
                "highlights": [],
                "suggestions": {"pro": [], "con": []}
            })
            
            # 创建评估对象
            evaluation = RoundEvaluation(
                round=round_num,
                pro_score=RoundScore(**result.get("pro_score", {})),
                con_score=RoundScore(**result.get("con_score", {})),
                round_winner=result.get("round_winner", "tie"),
                commentary=result.get("commentary", ""),
                highlights=result.get("highlights", []),
                suggestions=result.get("suggestions", {})
            )
            
            # 记录
            self.evaluations.append(evaluation)
            self.pro_scores.append(evaluation.pro_score)
            self.con_scores.append(evaluation.con_score)
            
            self.add_to_memory({
                "type": "evaluation",
                "round": round_num,
                "result": result
            })
            
            return evaluation
            
        except Exception as e:
            print(f"[JuryAgent] 评估出错: {e}")
            # 返回中性评分
            return RoundEvaluation(
                round=round_num,
                pro_score=RoundScore(logic=5, evidence=5, rhetoric=5, rebuttal=5),
                con_score=RoundScore(logic=5, evidence=5, rhetoric=5, rebuttal=5),
                round_winner="tie",
                commentary=f"评估过程出错: {str(e)}",
                highlights=[],
                suggestions={}
            )
    
    async def final_verdict(self) -> FinalVerdict:
        """给出最终裁决
        
        Returns:
            FinalVerdict 最终裁决
        """
        if not self.evaluations:
            return FinalVerdict(
                winner="tie",
                pro_total_score=0,
                con_total_score=0,
                margin="marginal",
                summary="没有可用的评估记录",
                pro_strengths=[],
                con_strengths=[],
                key_turning_points=[]
            )
        
        # 准备评估数据
        all_evaluations = [
            {
                "round": e.round,
                "pro_score": e.pro_score.model_dump(),
                "con_score": e.con_score.model_dump(),
                "round_winner": e.round_winner,
                "commentary": e.commentary
            }
            for e in self.evaluations
        ]
        
        prompt = self._build_verdict_prompt(all_evaluations)
        
        messages = [
            {"role": "system", "content": "你是辩论赛的终审评委，请给出公正的最终裁决。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self.ai_client.get_completion(messages, temperature=self.temperature)
            result = self._parse_json_response(response, {})
            
            # 计算总分
            pro_total = sum(s.total for s in self.pro_scores)
            con_total = sum(s.total for s in self.con_scores)
            
            verdict = FinalVerdict(
                winner=result.get("winner", "pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie")),
                pro_total_score=pro_total,
                con_total_score=con_total,
                margin=result.get("margin", "close"),
                summary=result.get("summary", ""),
                pro_strengths=result.get("pro_strengths", []),
                con_strengths=result.get("con_strengths", []),
                key_turning_points=result.get("key_turning_points", [])
            )
            
            self.update_belief("final_verdict", verdict.model_dump())
            
            return verdict
            
        except Exception as e:
            print(f"[JuryAgent] 最终裁决出错: {e}")
            pro_total = sum(s.total for s in self.pro_scores)
            con_total = sum(s.total for s in self.con_scores)
            
            return FinalVerdict(
                winner="pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie"),
                pro_total_score=pro_total,
                con_total_score=con_total,
                margin="close",
                summary=f"裁决过程出错: {str(e)}",
                pro_strengths=[],
                con_strengths=[],
                key_turning_points=[]
            )
    
    def get_current_standings(self) -> Dict[str, Any]:
        """获取当前比分"""
        pro_total = sum(s.total for s in self.pro_scores)
        con_total = sum(s.total for s in self.con_scores)
        
        pro_wins = sum(1 for e in self.evaluations if e.round_winner == "pro")
        con_wins = sum(1 for e in self.evaluations if e.round_winner == "con")
        ties = sum(1 for e in self.evaluations if e.round_winner == "tie")
        
        return {
            "rounds_completed": len(self.evaluations),
            "pro_total_score": pro_total,
            "con_total_score": con_total,
            "pro_round_wins": pro_wins,
            "con_round_wins": con_wins,
            "ties": ties,
            "leader": "pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie")
        }
    
    def reset(self) -> None:
        """重置评审状态"""
        self.evaluations = []
        self.pro_scores = []
        self.con_scores = []
        self.memory = []
        self.state.beliefs = {}
