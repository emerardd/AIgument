"""
苏格拉底式问答 API 路由

模式：socratic（引导提问）、structured（结构化直接回答）、hybrid（两者结合）
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from models.session import Session, Message
from services.ai_client import AIClient
from services.socratic_qa import create_socratic_qa
from utils import get_api_key, mark_session_status, sse_event, sse_response
from utils.logger import get_logger

router = APIRouter(prefix="/api", tags=["qa"])
logger = get_logger(__name__)


def _parse_history(history: str) -> list[dict]:
    if not history:
        return []
    try:
        parsed = json.loads(history)
    except json.JSONDecodeError as e:
        raise ValueError(f"history must be valid JSON: {e}") from e
    if not isinstance(parsed, list):
        raise ValueError("history must be a JSON array")
    return parsed


def _get_or_create_session(
    db: DBSession,
    session_id: Optional[int],
    session_type: str,
    topic: str,
    settings: dict,
) -> Session:
    if session_id is not None:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.session_type != session_type:
            raise HTTPException(status_code=400, detail="Session type mismatch")

        merged_settings = session.settings or {}
        merged_settings.update(settings)
        session.settings = merged_settings
        return session

    session = Session(session_type=session_type, topic=topic[:100], settings=settings)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ============================================================
# 苏格拉底式问答 API（新版）
# ============================================================

@router.get("/qa/modes")
def get_qa_modes():
    """获取可用的问答模式"""
    return {
        "modes": [
            {
                "id": "socratic",
                "name": "苏格拉底式",
                "description": "通过引导性问题帮助你思考，不直接给答案",
                "icon": "🤔"
            },
            {
                "id": "structured",
                "name": "结构化知识",
                "description": "返回结构化的知识卡片，包含要点、例子、相关话题",
                "icon": "📋"
            },
            {
                "id": "hybrid",
                "name": "混合模式",
                "description": "先引导思考，再给出结构化答案",
                "icon": "🔄"
            }
        ]
    }


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

    流式返回引导式或结构化回答。
    """
    async def generate():
        session = None
        try:
            api_key = get_api_key(provider)
            client = AIClient(provider=provider, model=model, api_key=api_key)

            qa_service = create_socratic_qa(client, mode=mode)

            history_list = _parse_history(history)
            qa_service.restore_history([
                {
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                }
                for msg in history_list
            ])

            session = _get_or_create_session(
                db=db,
                session_id=session_id,
                session_type="qa_socratic",
                topic=question,
                settings={"provider": provider, "model": model, "mode": mode},
            )
            mark_session_status(session, "running")
            db.commit()

            yield sse_event({"type": "session", "session_id": session.id, "mode": mode})

            user_msg = Message(session_id=session.id, role="user", content=question)
            db.add(user_msg)
            db.commit()

            full_response = ""
            async for event in qa_service.stream_ask(question):
                yield sse_event(event, ensure_ascii=False)
                if event.get("type") == "complete":
                    full_response = event.get("content", "")

            if full_response:
                assistant_msg = Message(
                    session_id=session.id,
                    role="assistant",
                    content=full_response,
                    meta_info={"mode": mode},
                )
                db.add(assistant_msg)
            mark_session_status(session, "completed")
            db.commit()

        except HTTPException as e:
            db.rollback()
            if session is not None:
                try:
                    mark_session_status(session, "failed", str(e.detail))
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("failed to mark socratic qa session as failed")
            yield sse_event({"type": "error", "error": e.detail})
        except Exception as e:
            db.rollback()
            if session is not None:
                try:
                    mark_session_status(session, "failed", str(e))
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("failed to mark socratic qa session as failed")
            logger.exception("stream socratic qa failed")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())
