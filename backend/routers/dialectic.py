"""
辩证法引擎 API

提供流式辩证法辩论与观点进化树查询。
"""
from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from models.session import Session, Message
from services.ai_client import AIClient
from agents import DialecticOrchestrator
from utils import get_api_key, mark_session_status, merge_session_settings, sse_event, sse_response
from utils.logger import get_logger

logger = get_logger(__name__)

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
    - opening / round_start / thesis / antithesis / synthesis / fallacy / tree_update / complete / error
    """
    async def generate():
        session = None
        try:
            api_key = get_api_key(provider)

            session = Session(
                session_type="dialectic",
                topic=topic,
                settings={
                    "rounds": rounds,
                    "provider": provider,
                    "model": model,
                    "temperature": temperature,
                    "seed": seed,
                    "preset": preset,
                    "mode": "dialectic",
                    "status": "running"
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)

            logger.info(f"创建辩证法会话: {session.id}")
            yield sse_event({"type": "session", "session_id": session.id})

            ai_client = AIClient(provider=provider, model=model, api_key=api_key, seed=seed)
            orchestrator = DialecticOrchestrator(ai_client=ai_client)
            await orchestrator.setup(
                topic=topic,
                total_rounds=rounds,
                provider=provider,
                model=model,
                temperature=temperature,
                seed=seed
            )

            messages_to_save = []
            last_tree = None

            async for event in orchestrator.run_stream():
                event_type = event.get("type", "")
                yield sse_event(event, ensure_ascii=False)

                if event_type in ("thesis", "antithesis", "synthesis"):
                    role_map = {
                        "thesis": "正题",
                        "antithesis": "反题",
                        "synthesis": "合题"
                    }
                    role = role_map.get(event_type, event_type)
                    messages_to_save.append({
                        "round": event.get("round"),
                        "role": role,
                        "content": event.get("content", ""),
                        "meta": {
                            "round": event.get("round"),
                            "side": event.get("side"),
                            "mode": "dialectic"
                        }
                    })

                if event_type == "tree_update":
                    last_tree = {
                        "nodes": event.get("nodes", []),
                        "edges": event.get("edges", [])
                    }

            for msg in messages_to_save:
                message = Message(
                    session_id=session.id,
                    role=msg["role"],
                    content=msg["content"],
                    meta_info=msg["meta"]
                )
                db.add(message)

            merge_session_settings(session, {
                "dialectic_trace": orchestrator.build_trace(),
                "dialectic_tree": last_tree,
                "status": "completed",
            })
            db.commit()
            logger.info(f"辩证法会话完成: {session.id}")

        except Exception as e:
            db.rollback()
            if session is not None:
                try:
                    mark_session_status(session, "failed", str(e))
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("failed to mark dialectic session as failed")
            logger.error(f"辩证法流式失败: {e}")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())


@router.get("/dialectic/{session_id}/tree")
async def get_dialectic_tree(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        return {"error": "Session not found"}
    settings = session.settings or {}
    return {
        "session_id": session_id,
        "tree": settings.get("dialectic_tree"),
        "trace": settings.get("dialectic_trace")
    }
