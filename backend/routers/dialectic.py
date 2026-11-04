"""
辩证法引擎 API

提供流式辩证法辩论与观点进化树查询。
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from models.session import Session
from repositories.session_run import SessionRunRepository
from routers.run_stream import stream_run, validate_request
from schemas.session_runs import DialecticRequest
from services.dialectic_run import DialecticRunService

router = APIRouter()


@router.get("/dialectic/stream")
async def stream_dialectic(
    topic: str = Query(..., min_length=1, max_length=500),
    rounds: int = Query(5, ge=1, le=10),
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    temperature: Optional[float] = None,
    seed: Optional[int] = None,
    preset: Optional[Literal["basic", "quality", "budget"]] = None,
    db: DBSession = Depends(get_db)
):
    """
    辩证法引擎流式接口（SSE）
    事件类型：
    - session / opening / round_start / thesis / antithesis / synthesis / fallacy / tree_update / complete / error
    """
    request = validate_request(
        DialecticRequest,
        topic=topic, rounds=rounds, provider=provider, model=model,
        temperature=temperature, seed=seed, preset=preset,
    )
    return stream_run(DialecticRunService(SessionRunRepository(db)), request)


@router.get("/dialectic/{session_id}/tree")
async def get_dialectic_tree(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    session = db.get(Session, session_id)
    if session is None or session.session_type != "dialectic":
        raise HTTPException(status_code=404, detail="Session not found")
    settings = session.settings or {}
    return {
        "session_id": session_id,
        "tree": settings.get("dialectic_tree"),
        "trace": settings.get("dialectic_trace")
    }
