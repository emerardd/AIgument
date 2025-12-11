"""
数据库模型 - Session和Message
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import Base


class Session(Base):
    """对话会话模型"""
    __tablename__ = "session"
    
    id = Column(Integer, primary_key=True, index=True)
    session_type = Column(String(20))  # debate/chat/qa
    topic = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    settings = Column(JSON)  # 存储会话设置
    
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_type": self.session_type,
            "topic": self.topic,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "settings": self.settings,
            "messages": [msg.to_dict() for msg in self.messages]
        }


class Message(Base):
    """消息记录模型"""
    __tablename__ = "message"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("session.id"), nullable=False)
    role = Column(String(50))  # 正方/反方/user/assistant
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    meta_info = Column(JSON)  # 存储额外信息
    
    session = relationship("Session", back_populates="messages")
    
    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "meta_info": self.meta_info
        }
