"""
传统辩论 API (Legacy)

非 Multi-Agent 的简单辩论接口
"""
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models.session import Session, Message
from schemas.debate import DebateRequest
from services.debater import Debater
from utils import get_api_key, sse_event, sse_response
from utils.logger import get_logger
from config import RUN_CONFIG_PRESETS

logger = get_logger(__name__)

router = APIRouter()


def create_debater(
    name: str,
    position: str,
    provider: str,
    model: str,
    api_key: str,
    temperature: float,
    seed: Optional[int]
) -> Debater:
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
        api_key=api_key,
        temperature=temperature,
        seed=seed
    )


@router.post("/debate")
async def debate(request: DebateRequest, db: DBSession = Depends(get_db)):
    """非流式辩论接口"""
    if request.stream:
        raise HTTPException(status_code=400, detail="此接口不支持流式输出，请使用 /api/debate/stream")
    
    try:
        api_key = get_api_key(request.provider)
        preset_config = RUN_CONFIG_PRESETS.get(request.preset, {}) if request.preset else {}
        temperature = request.temperature if request.temperature is not None else preset_config.get("temperature", 0.7)
        seed = request.seed if request.seed is not None else preset_config.get("seed")
        max_rounds = preset_config.get("max_rounds")
        total_rounds = min(request.rounds, max_rounds) if max_rounds else request.rounds
        
        # 创建会话记录
        session = Session(
            session_type="debate",
            topic=request.topic,
            settings={
                "rounds": total_rounds,
                "provider": request.provider,
                "model": request.model,
                "temperature": temperature,
                "seed": seed,
                "preset": request.preset
            }
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        logger.info(f"创建辩论会话: {session.id}, 主题: {request.topic}")
        
        # 创建辩论者
        pro_debater = create_debater(
            "正方", "正方（支持方）", request.provider, request.model, api_key, temperature, seed
        )
        con_debater = create_debater(
            "反方", "反方（反对方）", request.provider, request.model, api_key, temperature, seed
        )
        
        messages = []
        
        # 开场白
        opening = f"辩题：{request.topic}\n请正方开始第一轮发言。"
        
        for round_num in range(1, total_rounds + 1):
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
        logger.info(f"辩论完成: 会话 {session.id}")
        
        return {"session_id": session.id, "messages": messages}
        
    except Exception as e:
        db.rollback()
        logger.error(f"辩论失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debate/stream")
def stream_debate(
    topic: str,
    rounds: int = 3,
    provider: str = "deepseek",
    model: str = "deepseek-chat",
    temperature: Optional[float] = None,
    seed: Optional[int] = None,
    preset: Optional[Literal["basic", "quality", "budget"]] = None,
    db: DBSession = Depends(get_db)
):
    """流式辩论接口"""
    
    def generate():
        try:
            api_key = get_api_key(provider)
            preset_config = RUN_CONFIG_PRESETS.get(preset, {}) if preset else {}
            final_temperature = temperature if temperature is not None else preset_config.get("temperature", 0.7)
            final_seed = seed if seed is not None else preset_config.get("seed")
            max_rounds = preset_config.get("max_rounds")
            total_rounds = min(rounds, max_rounds) if max_rounds else rounds
            
            # 创建会话记录
            session = Session(
                session_type="debate",
                topic=topic,
                settings={
                    "rounds": total_rounds,
                    "provider": provider,
                    "model": model,
                    "temperature": final_temperature,
                    "seed": final_seed,
                    "preset": preset
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            # 发送会话ID
            yield sse_event({"type": "session", "session_id": session.id})
            
            # 创建辩论者
            pro_debater = create_debater(
                "正方", "正方（支持方）", provider, model, api_key, final_temperature, final_seed
            )
            con_debater = create_debater(
                "反方", "反方（反对方）", provider, model, api_key, final_temperature, final_seed
            )
            
            opening = f"辩题：{topic}\n请正方开始第一轮发言。"
            last_response = ""
            
            for round_num in range(1, total_rounds + 1):
                # 正方发言
                pro_input = opening if round_num == 1 else last_response
                pro_full = ""
                
                for chunk in pro_debater.stream_response(pro_input):
                    pro_full += chunk
                    yield sse_event({
                        "type": "content",
                        "round": round_num,
                        "side": "正方",
                        "content": pro_full,
                    })
                
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
                    yield sse_event({
                        "type": "content",
                        "round": round_num,
                        "side": "反方",
                        "content": con_full,
                    })
                
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
            
            yield sse_event({"type": "complete"})
            
        except Exception as e:
            db.rollback()
            logger.error(f"流式辩论失败: {e}")
            yield sse_event({"type": "error", "error": str(e)})

    return sse_response(generate())
