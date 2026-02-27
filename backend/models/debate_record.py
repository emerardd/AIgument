"""
辩论记录模型

持久化完整辩论数据，包括 trace、图谱、评分和裁决
"""
from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class DebateRecord(Base):
    """辩论记录 - 持久化完整辩论数据"""
    __tablename__ = "debate_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("session.id"), nullable=False, index=True)

    # 辩论元数据
    topic = Column(String(500), nullable=False)
    total_rounds = Column(Integer, default=3)
    winner = Column(String(10), nullable=True)  # pro / con / tie

    # 模型信息
    pro_provider = Column(String(50), nullable=True)
    pro_model = Column(String(100), nullable=True)
    con_provider = Column(String(50), nullable=True)
    con_model = Column(String(100), nullable=True)
    jury_model = Column(String(100), nullable=True)
    is_mixed = Column(Integer, default=0)  # 0 = 同模型, 1 = 混合模型

    # 评分
    total_score_pro = Column(Float, default=0.0)
    total_score_con = Column(Float, default=0.0)
    margin = Column(String(20), nullable=True)  # decisive / close / marginal

    # 完整数据（JSON）
    trace = Column(JSON, nullable=True)          # 完整辩论 trace
    graph = Column(JSON, nullable=True)          # 论点图谱数据
    verdict = Column(JSON, nullable=True)        # 最终裁决
    evaluations = Column(JSON, nullable=True)    # 各轮评分
    run_config = Column(JSON, nullable=True)     # 运行配置

    # 时间
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # 关联
    session = relationship("Session", backref="debate_record")

    def __repr__(self):
        return f"<DebateRecord(id={self.id}, topic='{self.topic[:30]}', winner='{self.winner}')>"
