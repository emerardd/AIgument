"""
评测 API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models.session import Session
from schemas.evaluation import EvaluationRunRequest, EvaluationCompareRequest
from services.evaluation import evaluate_trace, compare_traces


router = APIRouter(prefix="/api", tags=["evaluation"])


def _load_trace_from_session(session_id: int, db: DBSession) -> dict:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    trace = (session.settings or {}).get("trace")
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found for session")
    trace["trace_id"] = str(session.id)
    return trace


@router.post("/evaluation/run")
def run_evaluation(request: EvaluationRunRequest, db: DBSession = Depends(get_db)):
    if request.trace:
        trace = request.trace.model_dump()
    elif request.session_id is not None:
        trace = _load_trace_from_session(request.session_id, db)
    else:
        raise HTTPException(status_code=400, detail="session_id or trace is required")
    return evaluate_trace(trace)


@router.post("/evaluation/compare")
def compare_evaluation(request: EvaluationCompareRequest, db: DBSession = Depends(get_db)):
    if request.left_trace:
        left_trace = request.left_trace.model_dump()
    elif request.left_session_id is not None:
        left_trace = _load_trace_from_session(request.left_session_id, db)
    else:
        raise HTTPException(status_code=400, detail="left_session_id or left_trace is required")

    if request.right_trace:
        right_trace = request.right_trace.model_dump()
    elif request.right_session_id is not None:
        right_trace = _load_trace_from_session(request.right_session_id, db)
    else:
        raise HTTPException(status_code=400, detail="right_session_id or right_trace is required")

    return compare_traces(left_trace, right_trace)
