"""
对话API路由

支持两种模式：
1. 普通对话 (legacy) - 与 AI 助手对话
2. 双角色对话 (dual) - 两个 AI 角色围绕主题对话
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from config import DEFAULT_MODEL, DEFAULT_PROVIDER
from database import get_db
from models.session import Session, Message
from schemas.chat import ChatRequest, ChatMessage
from services.ai_client import AIClient
from services.dual_chat import create_dual_chat, ROLE_TEMPLATES
from utils import get_api_key, resolve_prompt, sse_event, sse_response
from utils.logger import get_logger

router = APIRouter(prefix="/api", tags=["chat"])
logger = get_logger(__name__)


def get_chat_system_prompt() -> str:
    """获取对话系统提示词（使用 prompt-vcs 管理）"""
    return resolve_prompt(
        "chat_system",
        "你是一个有帮助的AI助手。请用中文回答用户的问题，保持友好和专业。"
    )


def build_chat_messages(user_message: str, history: list[dict] | list[ChatMessage]) -> list[dict]:
    """Build a standard message list for chat completions."""
    messages = [{"role": "system", "content": get_chat_system_prompt()}]
    for msg in history:
        if isinstance(msg, dict):
            role = msg.get("role", "user")
            content = msg.get("content", "")
        else:
            role = msg.role
            content = msg.content
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})
    return messages


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


def _get_or_create_chat_session(
    db: DBSession,
    session_id: Optional[int],
    message: str,
    provider: str,
    model: str,
) -> Session:
    if session_id is not None:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.session_type != "chat":
            raise HTTPException(status_code=400, detail="Session type mismatch")

        settings = session.settings or {}
        settings.update({"provider": provider, "model": model})
        session.settings = settings
        return session

    session = Session(
        session_type="chat",
        topic=message[:100],
        settings={"provider": provider, "model": model}
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/chat")
async def chat(request: ChatRequest, db: DBSession = Depends(get_db)):
    """非流式对话接口"""
    if request.stream:
        raise HTTPException(status_code=400, detail="此接口不支持流式输出，请使用 /api/chat/stream")

    try:
        api_key = get_api_key(request.provider)
        client = AIClient(provider=request.provider, model=request.model, api_key=api_key)

        messages = build_chat_messages(request.message, request.history)

        # 获取回复
        response_content = await client.get_completion(messages)

        # 创建或更新会话
        session = _get_or_create_chat_session(
            db=db,
            session_id=request.session_id,
            message=request.message,
            provider=request.provider,
            model=request.model,
        )

        # 保存消息
        user_msg = Message(session_id=session.id, role="user", content=request.message)
        assistant_msg = Message(session_id=session.id, role="assistant", content=response_content)
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()

        # 同时返回标准 message 结构与平铺 content，兼容现有前端
        return {
            "session_id": session.id,
            "message": {"role": "assistant", "content": response_content},
            "content": response_content,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("chat failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/stream")
async def stream_chat(
    message: str,
    history: str = "[]",
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    session_id: Optional[int] = None,
    db: DBSession = Depends(get_db)
):
    """流式对话接口"""

    async def generate():
        try:
            api_key = get_api_key(provider)
            client = AIClient(provider=provider, model=model, api_key=api_key)

            history_list = _parse_history(history)
            messages = build_chat_messages(message, history_list)

            session = _get_or_create_chat_session(
                db=db,
                session_id=session_id,
                message=message,
                provider=provider,
                model=model,
            )

            yield sse_event({"type": "session", "session_id": session.id})

            user_msg = Message(session_id=session.id, role="user", content=message)
            db.add(user_msg)
            db.commit()

            full_response = ""
            async for chunk in client.chat_stream(messages):
                full_response += chunk
                yield sse_event({"type": "content", "content": full_response})

            assistant_msg = Message(session_id=session.id, role="assistant", content=full_response)
            db.add(assistant_msg)
            db.commit()

            yield sse_event({"type": "complete"})

        except HTTPException as e:
            db.rollback()
            yield sse_event({"type": "error", "error": e.detail})
        except Exception as e:
            db.rollback()
            logger.exception("stream chat failed")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())


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
    topic: str,
    role_a: str = "乐观主义者",
    role_b: str = "现实主义者",
    turns: int = 3,
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

            db.commit()

        except Exception as e:
            db.rollback()
            logger.exception("dual chat failed")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())
