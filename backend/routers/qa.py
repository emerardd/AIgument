"""
问答API路由
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
from schemas.qa import QARequest
from services.ai_client import AIClient
from utils import get_api_key

router = APIRouter(prefix="/api", tags=["qa"])


def get_style_prompt(style: str) -> str:
    """根据风格获取系统提示词"""
    prompts = {
        "professional": "你是一个专业的知识助手，请用准确、专业的方式回答问题。使用适当的术语，提供详实的信息。",
        "casual": "你是一个友好的聊天伙伴，请用轻松、口语化的方式回答问题。可以适当使用表情和语气词。",
        "detailed": "你是一个详细讲解的老师，请从多个角度全面回答问题。提供背景知识、相关概念和具体示例。",
        "concise": "你是一个高效的助手，请用简洁明了的方式回答问题。直接给出核心答案，不要太多铺垫。"
    }
    return prompts.get(style, prompts["professional"])


@router.post("/qa")
async def qa(request: QARequest, db: DBSession = Depends(get_db)):
    """非流式问答接口"""
    if request.stream:
        raise HTTPException(status_code=400, detail="此接口不支持流式输出，请使用 /api/stream-qa")
    
    try:
        api_key = get_api_key(request.provider)
        client = AIClient(provider=request.provider, model=request.model, api_key=api_key)
        
        # 构建消息
        system_prompt = get_style_prompt(request.style)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in request.history:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": request.question})
        
        # 获取回复
        response_content = client.get_completion(messages)
        
        # 创建会话
        session = Session(
            session_type="qa",
            topic=request.question[:100],
            settings={"provider": request.provider, "model": request.model, "style": request.style}
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
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
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/qa/stream")
def stream_qa(
    question: str,
    style: str = "professional",
    history: str = "[]",
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    db: DBSession = Depends(get_db)
):
    """流式问答接口"""
    
    def generate():
        try:
            api_key = get_api_key(provider)
            client = AIClient(provider=provider, model=model, api_key=api_key)
            
            # 解析历史消息
            history_list = json.loads(history) if history else []
            
            # 构建消息
            system_prompt = get_style_prompt(style)
            messages = [{"role": "system", "content": system_prompt}]
            for msg in history_list:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            messages.append({"role": "user", "content": question})
            
            # 创建会话
            session = Session(
                session_type="qa",
                topic=question[:100],
                settings={"provider": provider, "model": model, "style": style}
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            # 发送会话ID
            yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"
            
            # 保存用户消息
            user_msg = Message(session_id=session.id, role="user", content=question)
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
