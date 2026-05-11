"""
对话相关的Pydantic模型
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal

from config import DEFAULT_MODEL, DEFAULT_PROVIDER


class ChatMessage(BaseModel):
    """聊天消息模型"""
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    """聊天请求模型"""
    message: str = Field(..., min_length=1, description="用户消息")
    history: list[ChatMessage] = Field(default_factory=list, description="历史消息")
    provider: Literal["deepseek", "openai", "gemini", "claude", "mock"] = Field(
        default=DEFAULT_PROVIDER,
        description="AI提供商",
    )
    model: str = Field(default=DEFAULT_MODEL, description="模型名称")
    stream: bool = Field(default=True, description="是否使用流式输出")
    session_id: Optional[int] = Field(default=None, description="会话ID（用于续聊）")


class ChatResponse(BaseModel):
    """聊天响应模型"""
    session_id: Optional[int] = None
    message: ChatMessage
