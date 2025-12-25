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


# ============================================================
# Multi-Agent 辩论 API（新版）
# ============================================================

from agents import DebateOrchestrator
from services.ai_client import AIClient
import asyncio


@router.get("/debate/agent-stream")
async def agent_stream_debate(
    topic: str,
    rounds: int = 3,
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    db: DBSession = Depends(get_db)
):
    """
    Multi-Agent 流式辩论接口（增强版）
    
    使用 DebateOrchestrator 协调多个 Agent：
    - 正方 Agent：ReAct 推理 + 论点生成
    - 反方 Agent：ReAct 推理 + 论点生成
    - 评审 Agent：多维度评分 + 裁决
    
    返回的事件类型：
    - opening: 开场介绍
    - round_start: 轮次开始
    - thinking: Agent 思考过程（分析、策略）
    - argument: 论点内容
    - argument_complete: 论点完成
    - evaluation: 评审评分
    - standings: 实时比分
    - verdict: 最终裁决
    - complete: 辩论完成
    """
    
    async def generate():
        try:
            api_key = get_api_key(provider)
            
            # 创建会话记录
            session = Session(
                session_type="debate",
                topic=topic,
                settings={
                    "rounds": rounds,
                    "provider": provider,
                    "model": model,
                    "mode": "multi-agent"  # 标记为 Multi-Agent 模式
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            # 发送会话ID
            print(f"[DEBUG] Session created: {session.id}")
            yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"
            
            # 创建 AI 客户端和协调器
            ai_client = AIClient(provider=provider, model=model, api_key=api_key)
            orchestrator = DebateOrchestrator(ai_client=ai_client)
            
            # 初始化辩论
            await orchestrator.setup_debate(
                topic=topic,
                total_rounds=rounds,
                provider=provider,
                model=model
            )
            
            # 运行辩论
            messages_to_save = []
            
            async for event in orchestrator.run_debate():
                event_type = event.get("type", "")
                
                # 发送事件到客户端
                print(f"[DEBUG] Event: {event_type}")
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                
                # 收集需要保存的消息
                if event_type == "argument":
                    messages_to_save.append({
                        "round": event.get("round"),
                        "side": event.get("side"),
                        "name": event.get("name"),
                        "content": event.get("content"),
                        "thinking": None
                    })
                
                # 保存思考过程
                if event_type == "thinking" and messages_to_save:
                    # 将思考过程关联到下一条消息
                    pass
            
            # 保存所有消息到数据库
            for msg_data in messages_to_save:
                role = msg_data.get("name", msg_data.get("side", "unknown"))
                message = Message(
                    session_id=session.id,
                    role=role,
                    content=msg_data.get("content", ""),
                    meta_info={
                        "round": msg_data.get("round"),
                        "side": msg_data.get("side"),
                        "mode": "multi-agent"
                    }
                )
                db.add(message)
            
            # 保存最终状态
            final_state = orchestrator.get_full_state()
            session.settings["final_state"] = final_state
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            import traceback
            error_detail = traceback.format_exc()
            print(f"[Agent Debate Error] {error_detail}")
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


@router.post("/debate/agent")
async def agent_debate(
    request: DebateRequest,
    db: DBSession = Depends(get_db)
):
    """
    Multi-Agent 非流式辩论接口
    
    返回完整的辩论结果，包括：
    - 各轮发言
    - 思考过程
    - 评审评分
    - 最终裁决
    """
    try:
        api_key = get_api_key(request.provider)
        
        # 创建会话
        session = Session(
            session_type="debate",
            topic=request.topic,
            settings={
                "rounds": request.rounds,
                "provider": request.provider,
                "model": request.model,
                "mode": "multi-agent"
            }
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        # 创建协调器
        ai_client = AIClient(provider=request.provider, model=request.model, api_key=api_key)
        orchestrator = DebateOrchestrator(ai_client=ai_client)
        
        await orchestrator.setup_debate(
            topic=request.topic,
            total_rounds=request.rounds
        )
        
        # 收集所有事件
        events = []
        async for event in orchestrator.run_debate():
            events.append(event)
            
            # 保存论点消息
            if event.get("type") == "argument":
                message = Message(
                    session_id=session.id,
                    role=event.get("name", event.get("side")),
                    content=event.get("content", ""),
                    meta_info={
                        "round": event.get("round"),
                        "side": event.get("side"),
                        "mode": "multi-agent"
                    }
                )
                db.add(message)
        
        db.commit()
        
        # 提取关键信息
        arguments = [e for e in events if e.get("type") == "argument"]
        thinkings = [e for e in events if e.get("type") == "thinking"]
        evaluations = [e for e in events if e.get("type") == "evaluation"]
        verdict = next((e for e in events if e.get("type") == "verdict"), None)
        
        return {
            "session_id": session.id,
            "topic": request.topic,
            "rounds": request.rounds,
            "arguments": arguments,
            "thinkings": thinkings,
            "evaluations": evaluations,
            "verdict": verdict,
            "full_state": orchestrator.get_full_state()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 论点图谱 API
# ============================================================

from memory import ArgumentGraph, ArgumentAnalyzer, RelationType, ArgumentStrength


@router.get("/debate/{session_id}/graph")
async def get_argument_graph(
    session_id: int,
    analyze: bool = False,
    db: DBSession = Depends(get_db)
):
    """
    获取辩论会话的论点图谱
    
    Args:
        session_id: 会话 ID
        analyze: 是否使用 AI 分析论点关系（较慢但更准确）
        
    Returns:
        论点图谱数据，包括节点、边和摘要
    """
    try:
        # 获取会话
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # 获取消息
        messages = db.query(Message).filter(
            Message.session_id == session_id
        ).order_by(Message.created_at).all()
        
        if not messages:
            return {"error": "No messages in session"}
        
        # 构建图谱
        graph = ArgumentGraph(topic=session.topic or "")
        
        # 添加论点节点
        for msg in messages:
            author = "pro" if msg.role == "正方" else "con"
            round_num = msg.meta_info.get("round", 1) if msg.meta_info else 1
            
            # 简单的关键点提取（基于句子分割）
            content = msg.content or ""
            sentences = [s.strip() for s in content.replace("。", ".").split(".") if s.strip()]
            key_points = sentences[:3] if len(sentences) > 3 else sentences
            
            # 根据内容长度和结构判断强度
            strength = ArgumentStrength.MODERATE
            if len(content) > 400:
                strength = ArgumentStrength.STRONG
            elif len(content) < 100:
                strength = ArgumentStrength.WEAK
            
            graph.add_argument(
                content=content,
                author=author,
                round_num=round_num,
                key_points=key_points,
                strength=strength
            )
        
        # 简单的关系推断（相邻论点之间的攻击关系）
        node_list = list(graph.nodes.values())
        for i in range(1, len(node_list)):
            current = node_list[i]
            prev = node_list[i - 1]
            
            # 不同立场之间建立攻击关系
            if current.author != prev.author:
                graph.add_relation(
                    source_id=current.id,
                    target_id=prev.id,
                    relation=RelationType.ATTACKS,
                    strength=0.6,
                    description="回应"
                )
            else:
                # 同一立场建立支持关系
                graph.add_relation(
                    source_id=current.id,
                    target_id=prev.id,
                    relation=RelationType.BUILDS_ON,
                    strength=0.5,
                    description="延续"
                )
        
        return {
            "session_id": session_id,
            "graph": graph.to_dict(),
            "mermaid": graph.to_mermaid(),
            "scores": graph.calculate_debate_score(),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debate/{session_id}/graph/mermaid")
async def get_argument_graph_mermaid(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    """
    获取 Mermaid 格式的论点图谱
    
    可直接用于前端渲染
    """
    result = await get_argument_graph(session_id, False, db)
    return {"mermaid": result.get("mermaid", "")}


@router.get("/debate/{session_id}/analysis")
async def get_debate_analysis(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    """
    获取辩论分析
    
    包括：
    - 双方得分
    - 最强论点
    - 未被反驳的论点
    - 关键转折点
    """
    result = await get_argument_graph(session_id, False, db)
    graph_data = result.get("graph", {})
    scores = result.get("scores", {})
    
    # 提取分析
    pro_strongest = graph_data.get("summary", {}).get("pro_strongest", [])
    con_strongest = graph_data.get("summary", {}).get("con_strongest", [])
    
    return {
        "session_id": session_id,
        "scores": scores,
        "pro_strongest_arguments": pro_strongest,
        "con_strongest_arguments": con_strongest,
        "pro_unaddressed_count": scores.get("pro_unaddressed", 0),
        "con_unaddressed_count": scores.get("con_unaddressed", 0),
        "total_arguments": scores.get("total_arguments", 0),
        "total_relations": scores.get("total_relations", 0),
    }

