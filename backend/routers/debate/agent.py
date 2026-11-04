"""HTTP adapters for the shared multi-agent debate workflow."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from repositories.debate import DebateRepository
from routers.run_stream import stream_run, validate_request
from schemas.debate import DebateRequest
from services.debate_run import DebateRunService

router = APIRouter()
Provider = Literal["deepseek", "openai", "gemini", "claude", "mock"]


@router.get("/debate/agent-stream")
async def agent_stream_debate(
    topic: str = Query(..., min_length=1, max_length=500),
    rounds: int = Query(3, ge=1, le=10),
    provider: Provider = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    temperature: Optional[float] = Query(None, ge=0, le=1),
    seed: Optional[int] = None,
    preset: Optional[Literal["basic", "quality", "budget"]] = None,
    pro_provider: Optional[Provider] = None,
    pro_model: Optional[str] = None,
    con_provider: Optional[Provider] = None,
    con_model: Optional[str] = None,
    db: DBSession = Depends(get_db),
):
    request = validate_request(
        DebateRequest,
        topic=topic, rounds=rounds, provider=provider, model=model,
        temperature=temperature, seed=seed, preset=preset,
        pro_provider=pro_provider, pro_model=pro_model,
        con_provider=con_provider, con_model=con_model,
    )
    return stream_run(DebateRunService(DebateRepository(db)), request)


@router.post("/debate/agent")
async def agent_debate(request: DebateRequest, db: DBSession = Depends(get_db)):
    try:
        return await DebateRunService(DebateRepository(db)).collect(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
