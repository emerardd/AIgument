"""
辩论API路由
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
from schemas.debate import DebateRequest
from services.debater import Debater
from utils import get_api_key

router = APIRouter(prefix="/api", tags=["debate"])


def create_debater(name: str, position: str, provider: str, model: str, api_key: str) -> Debater:
    """创建辩论者实例"""
    system_prompt = f"""你是一个专业的辩论选手，代表{position}。
你需要用清晰的逻辑和有力的论据来支持你的立场。
请用中文回应，回答要简洁有力，每次回应控制在200-400字左右。
你需要：
1. 直接回应对方的论点
2. 提出自己的论据
3. 保持逻辑连贯性
"""
    return Debater(
        name=name,
        system_prompt=system_prompt,
        provider=provider,
        model=model,
        api_key=api_key
    )


@router.post("/debate")
async def debate(request: DebateRequest, db: DBSession = Depends(get_db)):
    """非流式辩论接口"""
    if request.stream:
        raise HTTPException(status_code=400, detail="此接口不支持流式输出，请使用 /api/stream-debate")
    
    try:
        api_key = get_api_key(request.provider)
        
        # 创建会话记录
        session = Session(
            session_type="debate",
            topic=request.topic,
            settings={
                "rounds": request.rounds,
                "provider": request.provider,
                "model": request.model
            }
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        # 创建辩论者
        pro_debater = create_debater("正方", "正方（支持方）", request.provider, request.model, api_key)
        con_debater = create_debater("反方", "反方（反对方）", request.provider, request.model, api_key)
        
        messages = []
        
        # 开场白
        opening = f"辩题：{request.topic}\n请正方开始第一轮发言。"
        
        for round_num in range(1, request.rounds + 1):
            # 正方发言
            pro_input = opening if round_num == 1 else messages[-1]["content"]
            pro_response = pro_debater.generate_response(pro_input)
            
            pro_msg = Message(
                session_id=session.id,
                role="正方",
                content=pro_response,
                meta_info={"round": round_num}
            )
            db.add(pro_msg)
            messages.append({"role": "正方", "content": pro_response, "round": round_num})
            
            # 反方发言
            con_response = con_debater.generate_response(pro_response)
            
            con_msg = Message(
                session_id=session.id,
                role="反方",
                content=con_response,
                meta_info={"round": round_num}
            )
            db.add(con_msg)
            messages.append({"role": "反方", "content": con_response, "round": round_num})
        
        db.commit()
        
        return {"session_id": session.id, "messages": messages}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debate/stream")
def stream_debate(
    topic: str,
    rounds: int = 3,
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    db: DBSession = Depends(get_db)
):
    """流式辩论接口"""
    
    def generate():
        try:
            api_key = get_api_key(provider)
            
            # 创建会话记录
            session = Session(
                session_type="debate",
                topic=topic,
                settings={
                    "rounds": rounds,
                    "provider": provider,
                    "model": model
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            # 发送会话ID
            yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"
            
            # 创建辩论者
            pro_debater = create_debater("正方", "正方（支持方）", provider, model, api_key)
            con_debater = create_debater("反方", "反方（反对方）", provider, model, api_key)
            
            opening = f"辩题：{topic}\n请正方开始第一轮发言。"
            last_response = ""
            
            for round_num in range(1, rounds + 1):
                # 正方发言
                pro_input = opening if round_num == 1 else last_response
                pro_full = ""
                
                for chunk in pro_debater.stream_response(pro_input):
                    pro_full += chunk
                    yield f"data: {json.dumps({'type': 'content', 'round': round_num, 'side': '正方', 'content': pro_full})}\n\n"
                
                # 保存正方消息
                pro_msg = Message(
                    session_id=session.id,
                    role="正方",
                    content=pro_full,
                    meta_info={"round": round_num}
                )
                db.add(pro_msg)
                db.commit()
                
                # 反方发言
                con_full = ""
                for chunk in con_debater.stream_response(pro_full):
                    con_full += chunk
                    yield f"data: {json.dumps({'type': 'content', 'round': round_num, 'side': '反方', 'content': con_full})}\n\n"
                
                # 保存反方消息
                con_msg = Message(
                    session_id=session.id,
                    role="反方",
                    content=con_full,
                    meta_info={"round": round_num}
                )
                db.add(con_msg)
                db.commit()
                
                last_response = con_full
            
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
