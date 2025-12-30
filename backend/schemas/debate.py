"""
辩论相关的Pydantic模型

提供辩论 API 的请求和响应模型定义
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


class DebateRequest(BaseModel):
    """
    辩论请求模型
    
    用于发起辩论会话的请求参数
    """
    topic: str = Field(
        ..., 
        min_length=1, 
        max_length=500,
        description="辩论话题",
        json_schema_extra={"example": "人工智能是否会取代人类工作"}
    )
    rounds: int = Field(
        default=3, 
        ge=1, 
        le=10, 
        description="辩论轮次数量"
    )
    provider: Literal["deepseek", "openai", "gemini", "claude"] = Field(
        default="deepseek", 
        description="AI 提供商"
    )
    model: str = Field(
        default="deepseek-chat", 
        description="使用的模型名称",
        json_schema_extra={"example": "deepseek-chat"}
    )
    stream: bool = Field(
        default=True, 
        description="是否使用流式输出"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "topic": "人工智能是否会取代人类工作",
                    "rounds": 3,
                    "provider": "deepseek",
                    "model": "deepseek-chat",
                    "stream": True
                }
            ]
        }
    }


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
