"""
问答API路由

支持三种模式：
1. 传统问答 (legacy) - 不同风格的直接回答
2. 苏格拉底式 (socratic) - 通过引导问题帮助用户思考
3. 结构化回答 (structured) - 返回结构化的知识卡片
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models.session import Session, Message
from schemas.qa import QARequest
from services.ai_client import AIClient
from services.socratic_qa import create_socratic_qa
from utils import get_api_key, resolve_prompt, sse_event, sse_response
from utils.logger import get_logger

router = APIRouter(prefix="/api", tags=["qa"])
logger = get_logger(__name__)


def get_style_prompt(style: str) -> str:
    """根据风格获取系统提示词（使用 prompt-vcs 管理）"""
    style_map = {
        "professional": (
            "qa_professional",
            "你是一个专业的知识助手，请用准确、专业的方式回答问题。使用适当的术语，提供详实的信息。",
        ),
        "casual": (
            "qa_casual",
            "你是一个友好的聊天伙伴，请用轻松、口语化的方式回答问题。可以适当使用表情和语气词。",
        ),
        "detailed": (
            "qa_detailed",
            "你是一个详细讲解的老师，请从多个角度全面回答问题。提供背景知识、相关概念和具体示例。",
        ),
        "comprehensive": (
            "qa_detailed",
            "你是一个详细讲解的老师，请从多个角度全面回答问题。提供背景知识、相关概念和具体示例。",
        ),
        "concise": (
            "qa_concise",
            "你是一个高效的助手，请用简洁明了的方式回答问题。直接给出核心答案，不要太多铺垫。",
        ),
    }
    prompt_id, default = style_map.get(style, style_map["professional"])
    return resolve_prompt(prompt_id, default)


def build_qa_messages(question: str, style: str, history: list[dict]) -> list[dict]:
    """Build a standard message list for QA completions."""
    messages = [{"role": "system", "content": get_style_prompt(style)}]
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": question})
    return messages


def _parse_history(history: str) -> list[dict]:
    if not history:
        return []
    parsed = json.loads(history)
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


@router.post("/qa")
async def qa(request: QARequest, db: DBSession = Depends(get_db)):
    """非流式问答接口"""
    if request.stream:
        raise HTTPException(status_code=400, detail="此接口不支持流式输出，请使用 /api/qa/stream")

    try:
        api_key = get_api_key(request.provider)
        client = AIClient(provider=request.provider, model=request.model, api_key=api_key)

        messages = build_qa_messages(
            question=request.question,
            style=request.style,
            history=request.history,
        )

        # 获取回复
        response_content = await client.get_completion(messages)

        # 创建或复用会话
        session = _get_or_create_session(
            db=db,
            session_id=request.session_id,
            session_type="qa",
            topic=request.question,
            settings={"provider": request.provider, "model": request.model, "style": request.style},
        )

        # 保存消息
        user_msg = Message(session_id=session.id, role="user", content=request.question)
        assistant_msg = Message(session_id=session.id, role="assistant", content=response_content)
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()

        return {
            "session_id": session.id,
            "answer": response_content,
            "style": request.style
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("qa failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/qa/stream")
async def stream_qa(
    question: str,
    style: str = "professional",
    history: str = "[]",
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    session_id: Optional[int] = None,
    db: DBSession = Depends(get_db)
):
    """流式问答接口"""

    async def generate():
        try:
            api_key = get_api_key(provider)
            client = AIClient(provider=provider, model=model, api_key=api_key)

            history_list = _parse_history(history)
            messages = build_qa_messages(question=question, style=style, history=history_list)

            session = _get_or_create_session(
                db=db,
                session_id=session_id,
                session_type="qa",
                topic=question,
                settings={"provider": provider, "model": model, "style": style},
            )

            yield sse_event({"type": "session", "session_id": session.id})

            user_msg = Message(session_id=session.id, role="user", content=question)
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
            logger.exception("stream qa failed")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())


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


@router.get("/qa/socratic")
async def socratic_qa(
    question: str,
    mode: str = "hybrid",  # socratic, structured, hybrid
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    session_id: Optional[int] = None,
    db: DBSession = Depends(get_db)
):
    """
    苏格拉底式问答接口（非流式）

    根据模式返回不同类型的回答：
    - socratic: 引导性问题和提示
    - structured: 结构化知识卡片
    - hybrid: 两者结合
    """
    try:
        api_key = get_api_key(provider)
        client = AIClient(provider=provider, model=model, api_key=api_key)

        # 创建苏格拉底服务
        qa_service = create_socratic_qa(client, mode=mode)

        # 获取回答
        result = await qa_service.ask(question)

        # 创建或复用会话
        session = _get_or_create_session(
            db=db,
            session_id=session_id,
            session_type="qa_socratic",
            topic=question,
            settings={
                "provider": provider,
                "model": model,
                "mode": mode,
                "qa_type": "socratic",
            },
        )

        # 保存问题
        user_msg = Message(session_id=session.id, role="user", content=question)
        assistant_msg = Message(
            session_id=session.id,
            role="assistant",
            content=json.dumps(result, ensure_ascii=False),
            meta_info={"mode": mode, "type": "socratic"}
        )
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()

        return {
            "session_id": session.id,
            "mode": mode,
            **result
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("socratic qa failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/qa/socratic-stream")
async def stream_socratic_qa(
    question: str,
    mode: str = "hybrid",
    history: str = "[]",
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    session_id: Optional[int] = None,
    db: DBSession = Depends(get_db)
):
    """
    苏格拉底式问答流式接口

    流式返回引导式或结构化回答。
    """
    async def generate():
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
                db.commit()

        except HTTPException as e:
            db.rollback()
            yield sse_event({"type": "error", "error": e.detail})
        except Exception as e:
            db.rollback()
            logger.exception("stream socratic qa failed")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())


@router.post("/qa/follow-up")
async def qa_follow_up(
    session_id: int,
    response: str,
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    db: DBSession = Depends(get_db)
):
    """
    苏格拉底式问答的跟进接口

    用户回答引导问题后，AI 评估理解程度并继续引导或确认。
    """
    try:
        # 获取会话
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # 获取历史消息
        messages = db.query(Message).filter(
            Message.session_id == session_id
        ).order_by(Message.created_at).all()

        api_key = get_api_key(provider)
        client = AIClient(provider=provider, model=model, api_key=api_key)

        # 创建服务并恢复历史
        qa_service = create_socratic_qa(client, mode="socratic")
        qa_service.restore_history([
            {
                "role": msg.role,
                "content": msg.content[:500] if msg.content else ""
            }
            for msg in messages
        ])

        # 处理用户回复
        result = await qa_service.follow_up(response)

        # 保存消息
        user_msg = Message(session_id=session_id, role="user", content=response)
        assistant_msg = Message(
            session_id=session_id,
            role="assistant",
            content=result.get("content", ""),
            meta_info={
                "understanding_level": result.get("understanding_level"),
                "next_step": result.get("next_step")
            }
        )
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()

        return {
            "session_id": session_id,
            **result
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("qa follow-up failed")
        raise HTTPException(status_code=500, detail=str(e))
