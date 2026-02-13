"""
辩证法引擎 API

提供流式辩证法辩论与观点进化树查询。
"""
import json
from typing import Optional, Literal
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models.session import Session, Message
from services.ai_client import AIClient
from agents import DialecticOrchestrator
from utils import get_api_key
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/dialectic/stream")
async def stream_dialectic(
    topic: str,
    rounds: int = 5,
    provider: str = "deepseek",
    model: str = "deepseek-chat",
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
    rounds = max(5, min(rounds, 10))

    async def generate():
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
                    "mode": "dialectic"
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)

            logger.info(f"创建辩证法会话: {session.id}")
            yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"

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
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

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

            settings = session.settings or {}
            settings["dialectic_trace"] = orchestrator.build_trace()
            settings["dialectic_tree"] = last_tree
            session.settings = settings
            db.commit()
            logger.info(f"辩证法会话完成: {session.id}")

        except Exception as e:
            db.rollback()
            logger.error(f"辩证法流式失败: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


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
