"""
数据库模型 - Session和Message
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base
from utils.timefmt import to_iso


class Session(Base):
    """对话会话模型"""
    __tablename__ = "session"

    id = Column(Integer, primary_key=True, index=True)
    session_type = Column(String(20), index=True)  # debate/chat/qa
    topic = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    # 运行配置（provider、model、轮数、模式等），不放运行结果
    settings = Column(JSON)
    # 生命周期：running / completed / failed / cancelled / interrupted
    status = Column(String(20), index=True, nullable=False, default="completed")
    error = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    # 模式专属的最终产物（如辩证法 trace 与进化树）；多 Agent 辩论结果在 DebateRecord
    result = Column(JSON, nullable=True)

    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "session_type": self.session_type,
            "topic": self.topic,
            "created_at": to_iso(self.created_at),
            "updated_at": to_iso(self.updated_at),
            "settings": self.settings,
            "status": self.status,
            "error": self.error,
            "completed_at": to_iso(self.completed_at),
            "result": self.result,
            "messages": [msg.to_dict() for msg in self.messages]
        }


class Message(Base):
    """消息记录模型"""
    __tablename__ = "message"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("session.id"), nullable=False, index=True)
    role = Column(String(50))  # 正方/反方/user/assistant
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    meta_info = Column(JSON)  # 存储额外信息

    session = relationship("Session", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "created_at": to_iso(self.created_at),
            "meta_info": self.meta_info
        }
