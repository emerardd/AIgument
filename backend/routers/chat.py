"""
对话API路由
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models.session import Session, Message
from schemas.chat import ChatRequest, ChatMessage
from services.ai_client import AIClient
from utils import get_api_key

router = APIRouter(prefix="/api", tags=["chat"])


CHAT_SYSTEM_PROMPT = """你是一个有帮助的AI助手。请用中文回答用户的问题，保持友好和专业。"""


@router.post("/chat")
async def chat(request: ChatRequest, db: DBSession = Depends(get_db)):
    """非流式对话接口"""
    if request.stream:
        raise HTTPException(status_code=400, detail="此接口不支持流式输出，请使用 /api/stream-chat")
    
    try:
        api_key = get_api_key(request.provider)
        client = AIClient(provider=request.provider, model=request.model, api_key=api_key)
        
        # 构建消息
        messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
        for msg in request.history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": request.message})
        
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
            
            # 构建消息
            messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
            for msg in history_list:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            messages.append({"role": "user", "content": message})
            
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
            yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"
            
            # 保存用户消息
            user_msg = Message(session_id=session.id, role="user", content=message)
            db.add(user_msg)
            db.commit()
            
            # 流式生成回复
            full_response = ""
            for chunk in client.chat_stream(messages):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'content', 'content': full_response})}\n\n"
            
            # 保存助手消息
            assistant_msg = Message(session_id=session.id, role="assistant", content=full_response)
            db.add(assistant_msg)
            db.commit()
            
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            
        except Exception as e:
            db.rollback()
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
