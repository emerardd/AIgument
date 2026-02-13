"""
评测相关模型
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from .trace import DebateTrace


class ScoreBreakdown(BaseModel):
    logic: float = Field(default=0.0, description="逻辑性评分")
    evidence: float = Field(default=0.0, description="论据质量评分")
    rebuttal: float = Field(default=0.0, description="反驳有效性评分")
    clarity: float = Field(default=0.0, description="语言清晰度评分")
    total: float = Field(default=0.0, description="综合得分")


class EvaluationResult(BaseModel):
    trace_id: Optional[str] = Field(default=None, description="Trace ID")
    overall: float = Field(default=0.0, description="综合评分")
    dimensions: ScoreBreakdown = Field(default_factory=ScoreBreakdown, description="维度评分")
    consistency: float = Field(default=0.0, description="一致性评分")
    pro_average: Optional[float] = Field(default=None, description="正方平均分")
    con_average: Optional[float] = Field(default=None, description="反方平均分")
    winner: Optional[str] = Field(default=None, description="胜方")
    notes: Optional[list[str]] = Field(default=None, description="评测说明")


class EvaluationRunRequest(BaseModel):
    session_id: Optional[int] = Field(default=None, description="会话ID")
    trace: Optional[DebateTrace] = Field(default=None, description="辩论Trace")


class EvaluationCompareRequest(BaseModel):
    left_session_id: Optional[int] = Field(default=None, description="左侧会话ID")
    right_session_id: Optional[int] = Field(default=None, description="右侧会话ID")
    left_trace: Optional[DebateTrace] = Field(default=None, description="左侧Trace")
    right_trace: Optional[DebateTrace] = Field(default=None, description="右侧Trace")


class EvaluationCompareResult(BaseModel):
    left: EvaluationResult = Field(description="左侧评测")
    right: EvaluationResult = Field(description="右侧评测")
    delta: Dict[str, Any] = Field(default_factory=dict, description="差异")
    winner: str = Field(default="tie", description="比较胜方: left/right/tie")
