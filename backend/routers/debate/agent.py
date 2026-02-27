"""
Multi-Agent 辩论 API

使用 DebateOrchestrator 协调多个 Agent 的高级辩论接口
"""
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models.session import Session, Message
from schemas.debate import DebateRequest
from services.ai_client import AIClient
from agents import DebateOrchestrator
from models.debate_record import DebateRecord
from utils import get_api_key, sse_event, sse_response
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/debate/agent-stream")
async def agent_stream_debate(
    topic: str,
    rounds: int = 3,
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    temperature: Optional[float] = None,
    seed: Optional[int] = None,
    preset: Optional[Literal["basic", "quality", "budget"]] = None,
    pro_provider: Optional[str] = None,
    pro_model: Optional[str] = None,
    con_provider: Optional[str] = None,
    con_model: Optional[str] = None,
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
                    "temperature": temperature,
                    "seed": seed,
                    "preset": preset,
                    "mode": "multi-agent"
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            logger.info(f"创建 Multi-Agent 辩论会话: {session.id}")
            yield sse_event({"type": "session", "session_id": session.id})
            
            # 创建 AI 客户端和协调器
            ai_client = AIClient(provider=provider, model=model, api_key=api_key, seed=seed)
            orchestrator = DebateOrchestrator(ai_client=ai_client)

            # 混合模型支持：为正反方创建独立的 AI 客户端
            pro_ai_client = None
            con_ai_client = None
            if pro_provider and pro_model:
                pro_api_key = get_api_key(pro_provider)
                pro_ai_client = AIClient(provider=pro_provider, model=pro_model, api_key=pro_api_key, seed=seed)
            if con_provider and con_model:
                con_api_key = get_api_key(con_provider)
                con_ai_client = AIClient(provider=con_provider, model=con_model, api_key=con_api_key, seed=seed)
            
            # 初始化辩论
            await orchestrator.setup_debate(
                topic=topic,
                total_rounds=rounds,
                provider=provider,
                model=model,
                temperature=temperature,
                seed=seed,
                preset=preset,
                pro_ai_client=pro_ai_client,
                con_ai_client=con_ai_client
            )
            settings = session.settings or {}
            settings["rounds"] = orchestrator.total_rounds
            settings["temperature"] = orchestrator.run_config.get("temperature")
            settings["seed"] = orchestrator.run_config.get("seed")
            settings["preset"] = orchestrator.run_config.get("preset")
            session.settings = settings
            
            # 运行辩论 - 使用流式版本
            messages_to_save = []
            
            async for event in orchestrator.run_debate_streaming():
                event_type = event.get("type", "")
                
                if event_type not in ("argument",):
                    logger.debug(f"Event: {event_type}")
                
                yield sse_event(event, ensure_ascii=False)
                
                # 只收集完整论点
                if event_type == "argument_complete":
                    messages_to_save.append({
                        "round": event.get("round"),
                        "side": event.get("side"),
                        "name": event.get("name"),
                        "content": event.get("content"),
                        "thinking": None
                    })
            
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
            trace = orchestrator.build_trace()
            settings = session.settings or {}
            settings["final_state"] = final_state
            settings["trace"] = trace
            session.settings = settings

            # 保存 DebateRecord
            run_cfg = orchestrator.run_config
            verdict_data = trace.get("verdict") or {}
            debate_record = DebateRecord(
                session_id=session.id,
                topic=topic,
                total_rounds=orchestrator.total_rounds,
                winner=verdict_data.get("winner"),
                pro_provider=run_cfg.get("pro_provider", run_cfg.get("provider")),
                pro_model=run_cfg.get("pro_model", run_cfg.get("model")),
                con_provider=run_cfg.get("con_provider", run_cfg.get("provider")),
                con_model=run_cfg.get("con_model", run_cfg.get("model")),
                jury_model=run_cfg.get("model"),
                is_mixed=1 if run_cfg.get("mixed_model") else 0,
                total_score_pro=verdict_data.get("pro_total_score", 0),
                total_score_con=verdict_data.get("con_total_score", 0),
                margin=verdict_data.get("margin"),
                trace=trace,
                verdict=verdict_data,
                evaluations=trace.get("evaluations"),
                run_config=run_cfg,
            )
            db.add(debate_record)
            
            db.commit()
            logger.info(f"Multi-Agent 辩论完成: 会话 {session.id}")
            
        except Exception as e:
            db.rollback()
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Agent 辩论失败: {error_detail}")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())


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
                "temperature": request.temperature,
                "seed": request.seed,
                "preset": request.preset,
                "mode": "multi-agent"
            }
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        logger.info(f"创建 Multi-Agent 辩论会话: {session.id}")
        
        # 创建协调器
        ai_client = AIClient(
            provider=request.provider,
            model=request.model,
            api_key=api_key,
            seed=request.seed
        )
        orchestrator = DebateOrchestrator(ai_client=ai_client)
        
        await orchestrator.setup_debate(
            topic=request.topic,
            total_rounds=request.rounds,
            provider=request.provider,
            model=request.model,
            temperature=request.temperature,
            seed=request.seed,
            preset=request.preset
        )
        settings = session.settings or {}
        settings["rounds"] = orchestrator.total_rounds
        settings["temperature"] = orchestrator.run_config.get("temperature")
        settings["seed"] = orchestrator.run_config.get("seed")
        settings["preset"] = orchestrator.run_config.get("preset")
        session.settings = settings
        
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
        
        settings = session.settings or {}
        settings["trace"] = orchestrator.build_trace()
        session.settings = settings
        db.commit()
        
        # 提取关键信息
        arguments = [e for e in events if e.get("type") == "argument"]
        thinkings = [e for e in events if e.get("type") == "thinking"]
        evaluations = [e for e in events if e.get("type") == "evaluation"]
        verdict = next((e for e in events if e.get("type") == "verdict"), None)
        
        logger.info(f"Multi-Agent 辩论完成: 会话 {session.id}")
        
        return {
            "session_id": session.id,
            "topic": request.topic,
            "rounds": orchestrator.total_rounds,
            "arguments": arguments,
            "thinkings": thinkings,
            "evaluations": evaluations,
            "verdict": verdict,
            "full_state": orchestrator.get_full_state()
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Agent 辩论失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
