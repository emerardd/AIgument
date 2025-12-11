"""
辩论相关的Pydantic模型
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


class DebateRequest(BaseModel):
    """辩论请求模型"""
    topic: str = Field(..., min_length=1, description="辩论话题")
    rounds: int = Field(default=3, ge=1, le=10, description="辩论轮次")
    provider: Literal["deepseek", "openai"] = Field(default="deepseek", description="AI提供商")
    model: str = Field(default="deepseek-chat", description="模型名称")
    stream: bool = Field(default=True, description="是否使用流式输出")


class DebateMessage(BaseModel):
    """辩论消息模型"""
    role: Literal["正方", "反方", "topic", "system"]
    content: str
    round: Optional[int] = None


class DebateResponse(BaseModel):
    """辩论响应模型"""
    session_id: int
    messages: list[DebateMessage]


class StreamEvent(BaseModel):
    """流式事件模型"""
    type: Literal["content", "complete", "error"]
    round: Optional[int] = None
    side: Optional[Literal["正方", "反方"]] = None
    content: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None
