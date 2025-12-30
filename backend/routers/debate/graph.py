"""
论点图谱 API

提供论点关系可视化和分析接口
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models.session import Session, Message
from memory import ArgumentGraph, ArgumentAnalyzer, RelationType, ArgumentStrength
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


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
        
        logger.info(f"构建论点图谱: 会话 {session_id}, 消息数 {len(messages)}")
        
        # 构建图谱
        graph = ArgumentGraph(topic=session.topic or "")
        
        # 添加论点节点
        for msg in messages:
            author = "pro" if msg.role == "正方" else "con"
            round_num = msg.meta_info.get("round", 1) if msg.meta_info else 1
            
            # 简单的关键点提取
            content = msg.content or ""
            sentences = [s.strip() for s in content.replace("。", ".").split(".") if s.strip()]
            key_points = sentences[:3] if len(sentences) > 3 else sentences
            
            # 根据内容长度判断强度
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
        
        # 简单的关系推断
        node_list = list(graph.nodes.values())
        for i in range(1, len(node_list)):
            current = node_list[i]
            prev = node_list[i - 1]
            
            if current.author != prev.author:
                graph.add_relation(
                    source_id=current.id,
                    target_id=prev.id,
                    relation=RelationType.ATTACKS,
                    strength=0.6,
                    description="回应"
                )
            else:
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
        logger.error(f"获取论点图谱失败: {e}")
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
