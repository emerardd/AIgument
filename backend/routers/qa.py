"""
苏格拉底式问答 API 路由

模式：socratic（引导提问）、structured（结构化直接回答）、hybrid（两者结合）
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from repositories.session_run import SessionRunRepository
from routers.run_stream import stream_run, validate_request
from schemas.session_runs import SocraticQARequest
from services.socratic_run import SocraticRunService

router = APIRouter(prefix="/api", tags=["qa"])

QA_MODES = [
    {
        "id": "socratic",
        "name": "苏格拉底式",
        "description": "通过引导性问题帮助你思考，不直接给答案",
        "icon": "🤔",
    },
    {
        "id": "structured",
        "name": "直接回答",
        "description": "直接给出分点的结构化答案和例子",
        "icon": "📋",
    },
    {
        "id": "hybrid",
        "name": "混合模式",
        "description": "先引导思考，再给出结构化答案",
        "icon": "🔄",
    },
]


@router.get("/qa/modes")
def get_qa_modes():
    """获取可用的问答模式"""
    return {"modes": QA_MODES}


@router.get("/qa/socratic-stream")
async def stream_socratic_qa(
    question: str = Query(..., min_length=1),
    mode: str = "hybrid",
    history: str = "[]",
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    session_id: Optional[int] = None,
    db: DBSession = Depends(get_db)
):
    """
    苏格拉底式问答流式接口

    传入 session_id 和 history 可继续已有会话。
    事件：session / thinking / content / complete / error
    """
    request = validate_request(
        SocraticQARequest,
        question=question, mode=mode, history=history,
        provider=provider, model=model, session_id=session_id,
    )
    return stream_run(SocraticRunService(SessionRunRepository(db)), request)
