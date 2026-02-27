"""
辩论分析 API

提供辩论数据的查询和统计
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func

from database import get_db
from models.session import Session
from models.debate_record import DebateRecord
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/debate/{session_id}")
async def get_debate_analysis(session_id: int, db: DBSession = Depends(get_db)):
    """获取完整辩论分析数据"""
    record = db.query(DebateRecord).filter(DebateRecord.session_id == session_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="辩论记录不存在")

    return {
        "id": record.id,
        "session_id": record.session_id,
        "topic": record.topic,
        "total_rounds": record.total_rounds,
        "winner": record.winner,
        "pro_model": f"{record.pro_provider}/{record.pro_model}" if record.pro_provider else None,
        "con_model": f"{record.con_provider}/{record.con_model}" if record.con_provider else None,
        "jury_model": record.jury_model,
        "is_mixed": bool(record.is_mixed),
        "total_score_pro": record.total_score_pro,
        "total_score_con": record.total_score_con,
        "margin": record.margin,
        "trace": record.trace,
        "graph": record.graph,
        "verdict": record.verdict,
        "evaluations": record.evaluations,
        "run_config": record.run_config,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "completed_at": record.completed_at.isoformat() if record.completed_at else None,
    }


@router.get("/stats")
async def get_debate_stats(db: DBSession = Depends(get_db)):
    """获取辩论统计数据"""
    total = db.query(func.count(DebateRecord.id)).scalar() or 0
    pro_wins = db.query(func.count(DebateRecord.id)).filter(DebateRecord.winner == "pro").scalar() or 0
    con_wins = db.query(func.count(DebateRecord.id)).filter(DebateRecord.winner == "con").scalar() or 0
    ties = db.query(func.count(DebateRecord.id)).filter(DebateRecord.winner == "tie").scalar() or 0
    mixed_count = db.query(func.count(DebateRecord.id)).filter(DebateRecord.is_mixed == 1).scalar() or 0

    # 模型使用统计
    model_stats = {}
    records = db.query(DebateRecord).all()
    for r in records:
        for model_name in [r.pro_model, r.con_model]:
            if model_name:
                model_stats[model_name] = model_stats.get(model_name, 0) + 1

    return {
        "total_debates": total,
        "pro_wins": pro_wins,
        "con_wins": con_wins,
        "ties": ties,
        "mixed_model_debates": mixed_count,
        "model_usage": model_stats,
    }
