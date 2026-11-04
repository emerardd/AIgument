"""
双角色对话 API 路由
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from models.session import Session, Message
from services.ai_client import AIClient
from services.dual_chat import create_dual_chat, ROLE_TEMPLATES
from utils import get_api_key, mark_session_status, sse_event, sse_response
from utils.logger import get_logger

router = APIRouter(prefix="/api", tags=["chat"])
logger = get_logger(__name__)


# ============================================================
# 双角色对话 API（新版）
# ============================================================

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

    两个 AI 角色围绕主题进行自然对话。

    Returns:
        SSE 事件流，包含：
        - start: 对话开始，包含角色信息
        - message: 正在生成的消息
        - message_complete: 消息生成完成
        - complete: 对话结束
    """
    async def generate():
        session = None
        try:
            api_key = get_api_key(provider)
            client = AIClient(provider=provider, model=model, api_key=api_key)

            dual_chat = create_dual_chat(
                ai_client=client,
                topic=topic,
                role_a_template=role_a,
                role_b_template=role_b,
            )

            session = Session(
                session_type="dual_chat",
                topic=topic,
                settings={
                    "provider": provider,
                    "model": model,
                    "role_a": role_a,
                    "role_b": role_b,
                    "turns": turns,
                    "mode": "dual_character",
                    "status": "running",
                },
            )
            db.add(session)
            db.commit()
            db.refresh(session)

            yield sse_event({"type": "session", "session_id": session.id})

            async for event in dual_chat.run_conversation(turns=turns):
                yield sse_event(event, ensure_ascii=False)

                if event.get("type") == "message_complete":
                    msg = Message(
                        session_id=session.id,
                        role=event.get("speaker", "unknown"),
                        content=event.get("content", ""),
                        meta_info={
                            "role_id": event.get("role_id"),
                            "turn": event.get("turn"),
                            "mode": "dual_character",
                        },
                    )
                    db.add(msg)

            mark_session_status(session, "completed")
            db.commit()

        except Exception as e:
            db.rollback()
            if session is not None:
                try:
                    mark_session_status(session, "failed", str(e))
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("failed to mark dual chat session as failed")
            logger.exception("dual chat failed")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())
