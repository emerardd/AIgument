"""
Trace 相关模型
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RunConfig(BaseModel):
    provider: str = Field(description="AI 提供商")
    model: str = Field(description="模型名称")
    temperature: float = Field(default=0.7, description="采样温度")
    seed: Optional[int] = Field(default=None, description="随机种子")
    max_rounds: int = Field(default=3, description="最大轮次")
    preset: Optional[str] = Field(default=None, description="预设配置")


class AgentTurn(BaseModel):
    round: int = Field(description="轮次")
    side: str = Field(description="立场: pro/con")
    role: str = Field(description="角色")
    thought: Optional[Dict[str, Any]] = Field(default=None, description="思考过程")
    action: str = Field(description="动作")
    result: str = Field(description="输出结果")
    score: Optional[Dict[str, Any]] = Field(default=None, description="评分分解")
    timestamp: Optional[str] = Field(default=None, description="时间戳")


class DebateTrace(BaseModel):
    trace_id: Optional[str] = Field(default=None, description="Trace ID")
    topic: str = Field(description="辩论主题")
    created_at: Optional[str] = Field(default=None, description="开始时间")
    run_config: RunConfig = Field(description="运行配置")
    turns: List[AgentTurn] = Field(default_factory=list, description="所有 Agent 回合")
    evaluations: Optional[List[Dict[str, Any]]] = Field(default=None, description="评审结果")
    verdict: Optional[Dict[str, Any]] = Field(default=None, description="最终裁决")
    standings: Optional[Dict[str, Any]] = Field(default=None, description="比分")
    message_history: Optional[List[Dict[str, Any]]] = Field(default=None, description="消息历史")
