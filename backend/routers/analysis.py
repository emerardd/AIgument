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
from utils.timefmt import to_iso

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
        "created_at": to_iso(record.created_at),
        "completed_at": to_iso(record.completed_at),
    }


def _model_label(provider: str | None, model: str | None) -> str | None:
    if not model:
        return None
    return f"{provider}/{model}" if provider else model


def _leaderboard(records: list[DebateRecord]) -> list[dict]:
    """Per-model results from mixed-model debates (same-model debates say nothing about a model)."""
    rows: dict[str, dict] = {}
    for record in records:
        if not record.is_mixed:
            continue
        sides = (
            ("pro", _model_label(record.pro_provider, record.pro_model), record.total_score_pro),
            ("con", _model_label(record.con_provider, record.con_model), record.total_score_con),
        )
        if sides[0][1] == sides[1][1]:
            continue
        for side, label, score in sides:
            if label is None:
                continue
            row = rows.setdefault(label, {"model": label, "debates": 0, "wins": 0, "losses": 0, "ties": 0, "_score": 0.0})
            row["debates"] += 1
            row["_score"] += score or 0
            if record.winner == "tie" or not record.winner:
                row["ties"] += 1
            elif record.winner == side:
                row["wins"] += 1
            else:
                row["losses"] += 1
    board = []
    for row in rows.values():
        score = row.pop("_score")
        row["win_rate"] = round(row["wins"] / row["debates"], 3)
        row["avg_score"] = round(score / row["debates"], 2)
        board.append(row)
    return sorted(board, key=lambda r: (-r["win_rate"], -r["debates"], r["model"]))


@router.get("/stats")
async def get_debate_stats(db: DBSession = Depends(get_db)):
    """辩论统计：胜负分布、混合模型排行与会话状态"""
    records = db.query(DebateRecord).all()
    winners = [record.winner for record in records]
    model_usage: dict[str, int] = {}
    for record in records:
        for label in (_model_label(record.pro_provider, record.pro_model), _model_label(record.con_provider, record.con_model)):
            if label:
                model_usage[label] = model_usage.get(label, 0) + 1

    status_rows = db.query(Session.status, func.count(Session.id)).group_by(Session.status).all()
    scores_pro = [r.total_score_pro or 0 for r in records]
    scores_con = [r.total_score_con or 0 for r in records]

    return {
        "total_debates": len(records),
        "pro_wins": winners.count("pro"),
        "con_wins": winners.count("con"),
        "ties": winners.count("tie"),
        "mixed_model_debates": sum(1 for r in records if r.is_mixed),
        "avg_score_pro": round(sum(scores_pro) / len(records), 2) if records else None,
        "avg_score_con": round(sum(scores_con) / len(records), 2) if records else None,
        "model_usage": model_usage,
        "leaderboard": _leaderboard(records),
        "sessions_by_status": {status: count for status, count in status_rows},
    }
