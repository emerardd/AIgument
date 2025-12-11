"""
历史记录相关的Pydantic模型
"""
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


SessionType = Literal["debate", "chat", "qa"]


class HistoryItem(BaseModel):
    """历史记录项"""
    session_id: int
    topic: str
    start_time: datetime
    message_count: int
    type: SessionType


class MessageDetail(BaseModel):
    """消息详情"""
    id: int
    role: str
    content: str
    created_at: datetime
    meta_info: Optional[dict] = None


class SessionDetail(BaseModel):
    """会话详情"""
    session_id: int
    type: SessionType
    topic: Optional[str] = None
    messages: list[MessageDetail]


class HistoryResponse(BaseModel):
    """历史记录响应"""
    history: list[HistoryItem]
    total: int
