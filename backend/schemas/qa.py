"""
问答相关的Pydantic模型
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


QAStyle = Literal["professional", "casual", "detailed", "concise", "comprehensive"]


class QARequest(BaseModel):
    """问答请求模型"""
    question: str = Field(..., min_length=1, description="用户问题")
    style: QAStyle = Field(default="professional", description="回答风格")
    history: list[dict] = Field(default_factory=list, description="历史消息")
    provider: Literal["deepseek", "openai", "gemini", "claude", "mock"] = Field(
        default="deepseek",
        description="AI提供商",
    )
    model: str = Field(default="deepseek-chat", description="模型名称")
    stream: bool = Field(default=True, description="是否使用流式输出")
    session_id: Optional[int] = Field(default=None, description="会话ID（用于续聊）")


class QAResponse(BaseModel):
    """问答响应模型"""
    session_id: Optional[int] = None
    answer: str
    style: QAStyle
