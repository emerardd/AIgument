"""
双角色对话 API 路由
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from repositories.session_run import SessionRunRepository
from routers.run_stream import stream_run, validate_request
from schemas.session_runs import DualChatRequest
from services.dual_chat import ROLE_TEMPLATES
from services.dual_chat_run import DualChatRunService

router = APIRouter(prefix="/api", tags=["chat"])


@router.get("/chat/roles")
def get_available_roles():
    """获取可用的角色模板"""
    return {
        "roles": [
            {
                "id": key,
                "name": role.name,
                "persona": role.persona,
                "style": role.speaking_style,
                "position": role.position
            }
            for key, role in ROLE_TEMPLATES.items()
        ]
    }


@router.get("/chat/dual-stream")
async def stream_dual_chat(
    topic: str = Query(..., min_length=1, max_length=500),
    role_a: str = "乐观主义者",
    role_b: str = "现实主义者",
    turns: int = Query(3, ge=1, le=20),
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    db: DBSession = Depends(get_db)
):
    """
    双角色对话流式接口

    事件：session / start / message / message_complete / complete / error
    """
    request = validate_request(
        DualChatRequest,
        topic=topic, role_a=role_a, role_b=role_b, turns=turns, provider=provider, model=model,
    )
    return stream_run(DualChatRunService(SessionRunRepository(db)), request)
