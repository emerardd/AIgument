"""
对话API路由

支持两种模式：
1. 普通对话 (legacy) - 与 AI 助手对话
2. 双角色对话 (dual) - 两个 AI 角色围绕主题对话
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models.session import Session, Message
from schemas.chat import ChatRequest, ChatMessage
from services.ai_client import AIClient
from services.dual_chat import create_dual_chat, ROLE_TEMPLATES
from utils import get_api_key, resolve_prompt, sse_event, sse_response

router = APIRouter(prefix="/api", tags=["chat"])

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


@router.post("/chat")
async def chat(request: ChatRequest, db: DBSession = Depends(get_db)):
    """非流式对话接口"""
    if request.stream:
        raise HTTPException(status_code=400, detail="此接口不支持流式输出，请使用 /api/stream-chat")
    
    try:
        api_key = get_api_key(request.provider)
        client = AIClient(provider=request.provider, model=request.model, api_key=api_key)
        
        messages = build_chat_messages(request.message, request.history)
        
        # 获取回复
        response_content = client.get_completion(messages)
        
        # 创建或更新会话
        session = Session(
            session_type="chat",
            topic=request.message[:100],
            settings={"provider": request.provider, "model": request.model}
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        # 保存消息
        user_msg = Message(session_id=session.id, role="user", content=request.message)
        assistant_msg = Message(session_id=session.id, role="assistant", content=response_content)
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()
        
        return {
            "session_id": session.id,
            "message": {"role": "assistant", "content": response_content}
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/stream")
def stream_chat(
    message: str,
    history: str = "[]",  # JSON字符串
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    db: DBSession = Depends(get_db)
):
    """流式对话接口"""
    
    def generate():
        try:
            api_key = get_api_key(provider)
            client = AIClient(provider=provider, model=model, api_key=api_key)
            
            # 解析历史消息
            history_list = json.loads(history) if history else []
            
            messages = build_chat_messages(message, history_list)
            
            # 创建会话
            session = Session(
                session_type="chat",
                topic=message[:100],
                settings={"provider": provider, "model": model}
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            # 发送会话ID
            yield sse_event({"type": "session", "session_id": session.id})
            
            # 保存用户消息
            user_msg = Message(session_id=session.id, role="user", content=message)
            db.add(user_msg)
            db.commit()
            
            # 流式生成回复
            full_response = ""
            for chunk in client.chat_stream(messages):
                full_response += chunk
                yield sse_event({"type": "content", "content": full_response})
            
            # 保存助手消息
            assistant_msg = Message(session_id=session.id, role="assistant", content=full_response)
            db.add(assistant_msg)
            db.commit()
            
            yield sse_event({"type": "complete"})
            
        except Exception as e:
            db.rollback()
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
def stream_dual_chat(
    topic: str,
    role_a: str = "乐观主义者",
    role_b: str = "现实主义者",
    turns: int = 3,
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    db: DBSession = Depends(get_db)
):
    """
    双角色对话流式接口
    
    两个 AI 角色围绕主题进行自然对话。
    
    Args:
        topic: 对话主题
        role_a: 角色A模板名称
        role_b: 角色B模板名称
        turns: 对话轮次
        provider: AI 提供商
        model: 模型
    
    Returns:
        SSE 事件流，包含：
        - start: 对话开始，包含角色信息
        - message: 正在生成的消息
        - message_complete: 消息生成完成
        - complete: 对话结束
    """
    def generate():
        try:
            api_key = get_api_key(provider)
            client = AIClient(provider=provider, model=model, api_key=api_key)
            
            # 创建双角色对话服务
            dual_chat = create_dual_chat(
                ai_client=client,
                topic=topic,
                role_a_template=role_a,
                role_b_template=role_b
            )
            
            # 创建会话
            session = Session(
                session_type="dual_chat",
                topic=topic,
                settings={
                    "provider": provider,
                    "model": model,
                    "role_a": role_a,
                    "role_b": role_b,
                    "turns": turns,
                    "mode": "dual_character"
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            yield sse_event({"type": "session", "session_id": session.id})
            
            # 运行对话
            for event in dual_chat.run_conversation(turns=turns):
                yield sse_event(event, ensure_ascii=False)
                
                # 保存消息到数据库
                if event.get("type") == "message_complete":
                    msg = Message(
                        session_id=session.id,
                        role=event.get("speaker", "unknown"),
                        content=event.get("content", ""),
                        meta_info={
                            "role_id": event.get("role_id"),
                            "turn": event.get("turn"),
                            "mode": "dual_character"
                        }
                    )
                    db.add(msg)
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            import traceback
            print(f"[Dual Chat Error] {traceback.format_exc()}")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())

