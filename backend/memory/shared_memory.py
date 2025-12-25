"""
共享记忆

为 Multi-Agent 系统提供共享状态存储，支持：
- 辩论历史记录
- Agent 状态存储
- 实时比分追踪
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
import json


class DebateEvent(BaseModel):
    """辩论事件"""
    id: str = Field(description="事件ID")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")
    event_type: str = Field(description="事件类型")
    round: int = Field(default=0, description="轮次")
    agent: str = Field(default="", description="相关Agent")
    content: Dict[str, Any] = Field(default_factory=dict, description="事件内容")


class ArgumentRecord(BaseModel):
    """论点记录"""
    id: str = Field(description="论点ID")
    round: int = Field(description="轮次")
    side: str = Field(description="立场: pro/con")
    agent_name: str = Field(description="Agent名称")
    content: str = Field(description="论点内容")
    thinking: Optional[Dict[str, Any]] = Field(default=None, description="思考过程")
    timestamp: datetime = Field(default_factory=datetime.now)


class SharedMemory:
    """通用共享记忆基类"""
    
    def __init__(self):
        self.data: Dict[str, Any] = {}
        self.events: List[Dict[str, Any]] = []
    
    def set(self, key: str, value: Any) -> None:
        """设置值"""
        self.data[key] = value
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取值"""
        return self.data.get(key, default)
    
    def add_event(self, event: Dict[str, Any]) -> None:
        """添加事件"""
        event["timestamp"] = datetime.now().isoformat()
        self.events.append(event)
    
    def get_events(self, event_type: str = None, limit: int = None) -> List[Dict[str, Any]]:
        """获取事件"""
        events = self.events
        if event_type:
            events = [e for e in events if e.get("type") == event_type]
        if limit:
            events = events[-limit:]
        return events
    
    def clear(self) -> None:
        """清空记忆"""
        self.data = {}
        self.events = []


class DebateMemory(SharedMemory):
    """辩论专用共享记忆
    
    存储整场辩论的共享状态，供所有 Agent 访问：
    - 辩论主题和配置
    - 各轮论点和思考过程
    - 评分和裁决
    - 实时比分
    """
    
    def __init__(self, topic: str = "", total_rounds: int = 3):
        super().__init__()
        self.topic = topic
        self.total_rounds = total_rounds
        self.current_round = 0
        self.status = "not_started"  # not_started, in_progress, completed
        
        # 论点存储
        self.arguments: List[ArgumentRecord] = []
        
        # 评分存储
        self.evaluations: List[Dict[str, Any]] = []
        
        # 初始化数据
        self.set("topic", topic)
        self.set("total_rounds", total_rounds)
        self.set("pro_score", 0)
        self.set("con_score", 0)
    
    def start_debate(self) -> None:
        """开始辩论"""
        self.status = "in_progress"
        self.current_round = 1
        self.add_event({
            "type": "debate_start",
            "topic": self.topic,
            "total_rounds": self.total_rounds
        })
    
    def start_round(self, round_num: int) -> None:
        """开始新一轮"""
        self.current_round = round_num
        self.add_event({
            "type": "round_start",
            "round": round_num
        })
    
    def add_argument(
        self,
        side: str,
        agent_name: str,
        content: str,
        thinking: Dict[str, Any] = None
    ) -> ArgumentRecord:
        """添加论点
        
        Args:
            side: 立场 pro/con
            agent_name: Agent 名称
            content: 论点内容
            thinking: 思考过程
            
        Returns:
            ArgumentRecord
        """
        record = ArgumentRecord(
            id=f"arg_{self.current_round}_{side}",
            round=self.current_round,
            side=side,
            agent_name=agent_name,
            content=content,
            thinking=thinking
        )
        self.arguments.append(record)
        
        self.add_event({
            "type": "argument",
            "round": self.current_round,
            "side": side,
            "agent": agent_name,
            "content_preview": content[:100] + "..." if len(content) > 100 else content
        })
        
        return record
    
    def add_evaluation(self, evaluation: Dict[str, Any]) -> None:
        """添加评估结果"""
        self.evaluations.append(evaluation)
        
        # 更新总分
        if "pro_score" in evaluation:
            pro_score = evaluation["pro_score"]
            if isinstance(pro_score, dict):
                total = sum(pro_score.values())
            else:
                total = pro_score
            current_pro = self.get("pro_score", 0)
            self.set("pro_score", current_pro + total)
        
        if "con_score" in evaluation:
            con_score = evaluation["con_score"]
            if isinstance(con_score, dict):
                total = sum(con_score.values())
            else:
                total = con_score
            current_con = self.get("con_score", 0)
            self.set("con_score", current_con + total)
        
        self.add_event({
            "type": "evaluation",
            "round": evaluation.get("round", self.current_round),
            "winner": evaluation.get("round_winner", "tie")
        })
    
    def end_round(self, round_num: int) -> None:
        """结束一轮"""
        self.add_event({
            "type": "round_end",
            "round": round_num
        })
    
    def complete_debate(self, verdict: Dict[str, Any] = None) -> None:
        """完成辩论"""
        self.status = "completed"
        self.add_event({
            "type": "debate_complete",
            "verdict": verdict
        })
    
    def get_round_arguments(self, round_num: int) -> List[ArgumentRecord]:
        """获取指定轮次的论点"""
        return [a for a in self.arguments if a.round == round_num]
    
    def get_side_arguments(self, side: str) -> List[ArgumentRecord]:
        """获取指定立场的所有论点"""
        return [a for a in self.arguments if a.side == side]
    
    def get_last_argument(self, side: str = None) -> Optional[ArgumentRecord]:
        """获取最后一个论点"""
        args = self.arguments if side is None else self.get_side_arguments(side)
        return args[-1] if args else None
    
    def get_current_standings(self) -> Dict[str, Any]:
        """获取当前比分"""
        pro_wins = sum(1 for e in self.evaluations if e.get("round_winner") == "pro")
        con_wins = sum(1 for e in self.evaluations if e.get("round_winner") == "con")
        
        return {
            "current_round": self.current_round,
            "total_rounds": self.total_rounds,
            "pro_total_score": self.get("pro_score", 0),
            "con_total_score": self.get("con_score", 0),
            "pro_round_wins": pro_wins,
            "con_round_wins": con_wins,
            "status": self.status
        }
    
    def get_debate_history(self) -> List[Dict[str, Any]]:
        """获取完整辩论历史"""
        history = []
        for arg in self.arguments:
            entry = {
                "round": arg.round,
                "side": arg.side,
                "agent": arg.agent_name,
                "content": arg.content,
                "timestamp": arg.timestamp.isoformat()
            }
            if arg.thinking:
                entry["thinking"] = arg.thinking
            history.append(entry)
        return history
    
    def get_full_state(self) -> Dict[str, Any]:
        """获取完整状态（用于序列化）"""
        return {
            "topic": self.topic,
            "total_rounds": self.total_rounds,
            "current_round": self.current_round,
            "status": self.status,
            "standings": self.get_current_standings(),
            "arguments": [
                {
                    "id": a.id,
                    "round": a.round,
                    "side": a.side,
                    "agent": a.agent_name,
                    "content": a.content,
                    "thinking": a.thinking,
                    "timestamp": a.timestamp.isoformat()
                }
                for a in self.arguments
            ],
            "evaluations": self.evaluations,
            "events": self.events
        }
    
    def export_transcript(self) -> str:
        """导出辩论记录为文本"""
        lines = [
            f"# 辩论记录",
            f"",
            f"**主题**: {self.topic}",
            f"**轮次**: {self.total_rounds}",
            f"**状态**: {self.status}",
            f"",
            "---",
            ""
        ]
        
        for round_num in range(1, self.current_round + 1):
            lines.append(f"## 第 {round_num} 轮")
            lines.append("")
            
            round_args = self.get_round_arguments(round_num)
            for arg in round_args:
                side_label = "正方" if arg.side == "pro" else "反方"
                lines.append(f"### {side_label}")
                lines.append("")
                lines.append(arg.content)
                lines.append("")
            
            # 评分
            for eval_ in self.evaluations:
                if eval_.get("round") == round_num:
                    lines.append(f"**评审点评**: {eval_.get('commentary', '')}")
                    lines.append(f"**本轮胜者**: {eval_.get('round_winner', 'tie')}")
                    lines.append("")
            
            lines.append("---")
            lines.append("")
        
        # 最终结果
        standings = self.get_current_standings()
        lines.append("## 最终比分")
        lines.append("")
        lines.append(f"- 正方总分: {standings['pro_total_score']}")
        lines.append(f"- 反方总分: {standings['con_total_score']}")
        lines.append(f"- 正方获胜轮次: {standings['pro_round_wins']}")
        lines.append(f"- 反方获胜轮次: {standings['con_round_wins']}")
        
        return "\n".join(lines)
