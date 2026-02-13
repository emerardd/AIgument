"""
历史记录API路由
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func

from database import get_db
from models.session import Session, Message

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def get_history(
    type: str = "all",
    db: DBSession = Depends(get_db)
):
    """获取历史记录列表"""
    try:
        query = db.query(
            Session.id.label("session_id"),
            Session.topic,
            Session.session_type.label("type"),
            Session.created_at.label("start_time"),
            func.count(Message.id).label("message_count")
        ).outerjoin(Message).group_by(Session.id)
        
        if type != "all":
            query = query.filter(Session.session_type == type)
        
        query = query.order_by(Session.created_at.desc())
        results = query.all()
        
        history = []
        for r in results:
            history.append({
                "session_id": r.session_id,
                "topic": r.topic or "未命名会话",
                "type": r.type,
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "message_count": r.message_count
            })
        
        return {"history": history, "total": len(history)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}")
async def get_session_detail(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    """获取会话详情"""
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        messages = db.query(Message).filter(
            Message.session_id == session_id
        ).order_by(Message.created_at).all()
        
        return {
            "session_id": session.id,
            "type": session.session_type,
            "topic": session.topic,
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                    "meta_info": msg.meta_info
                }
                for msg in messages
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history/{session_id}")
async def delete_session(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    """删除会话"""
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        db.delete(session)
        db.commit()
        
        return {"success": True, "message": "会话已删除"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}/export")
async def export_session(
    session_id: int,
    format: str = "json",
    db: DBSession = Depends(get_db)
):
    """导出会话"""
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        messages = db.query(Message).filter(
            Message.session_id == session_id
        ).order_by(Message.created_at).all()
        
        if format == "markdown":
            # Markdown格式
            content = f"# {session.topic or '会话记录'}\n\n"
            content += f"类型: {session.session_type}\n"
            content += f"时间: {session.created_at.isoformat() if session.created_at else 'N/A'}\n\n"
            content += "---\n\n"
            
            for msg in messages:
                role_label = msg.role
                if msg.role == "user":
                    role_label = "👤 用户"
                elif msg.role == "assistant":
                    role_label = "🤖 AI"
                elif msg.role == "正方":
                    role_label = "👍 正方"
                elif msg.role == "反方":
                    role_label = "👎 反方"
                
                content += f"### {role_label}\n\n{msg.content}\n\n"
            
            return Response(
                content=content,
                media_type="text/markdown",
                headers={
                    "Content-Disposition": f"attachment; filename=session_{session_id}.md"
                }
            )
        else:
            # JSON格式
            data = {
                "session_id": session.id,
                "type": session.session_type,
                "topic": session.topic,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "messages": [
                    {
                        "role": msg.role,
                        "content": msg.content,
                        "created_at": msg.created_at.isoformat() if msg.created_at else None
                    }
                    for msg in messages
                ]
            }
            
            return Response(
                content=json.dumps(data, ensure_ascii=False, indent=2),
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=session_{session_id}.json"
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
