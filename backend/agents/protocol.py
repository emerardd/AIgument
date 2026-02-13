"""
Agent 通信协议 (Agent Communication Protocol)

定义 Agent 之间的消息格式和通信规范，支持：
- 结构化消息类型
- 消息广播和定向发送
- 消息历史追踪
- 协议验证
"""

from typing import Dict, Any, List, Optional, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import json
import uuid


class MessageType(Enum):
    """消息类型"""
    # 辩论相关
    ARGUMENT = "argument"           # 论点发言
    REBUTTAL = "rebuttal"           # 反驳
    QUESTION = "question"           # 质询
    ANSWER = "answer"               # 回答
    CONCESSION = "concession"       # 让步
    
    # Agent 协调
    REQUEST = "request"             # 请求
    RESPONSE = "response"           # 响应
    INFORM = "inform"               # 通知
    QUERY = "query"                 # 查询
    CONFIRM = "confirm"             # 确认
    REJECT = "reject"               # 拒绝
    
    # 系统消息
    SYSTEM = "system"               # 系统消息
    ERROR = "error"                 # 错误
    STATUS = "status"               # 状态更新
    
    # 评审相关
    EVALUATION = "evaluation"       # 评估
    SCORE = "score"                 # 评分
    VERDICT = "verdict"             # 裁决


class MessagePriority(Enum):
    """消息优先级"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4


@dataclass
class MessagePayload:
    """标准化消息内容"""
    role: str = ""
    thought: Optional[Dict[str, Any]] = None
    action: str = ""
    result: Optional[Any] = None
    score: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "thought": self.thought,
            "action": self.action,
            "result": self.result,
            "score": self.score,
        }


def _normalize_content(content: Union[str, Dict[str, Any], MessagePayload]) -> Dict[str, Any]:
    """规范化消息内容，确保 role/thought/action/result/score 字段存在"""
    if isinstance(content, MessagePayload):
        data = content.to_dict()
    elif isinstance(content, dict):
        data = content
    else:
        data = {"result": content}

    return {
        "role": data.get("role", ""),
        "thought": data.get("thought"),
        "action": data.get("action", ""),
        "result": data.get("result"),
        "score": data.get("score"),
    }


@dataclass
class AgentMessage:
    """Agent 消息
    
    标准化的 Agent 间通信消息格式。
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    sender: str = ""                    # 发送者 Agent ID
    receiver: str = ""                  # 接收者 Agent ID，空表示广播
    message_type: MessageType = MessageType.INFORM
    priority: MessagePriority = MessagePriority.NORMAL
    
    # 消息内容
    content: Union[str, Dict[str, Any]] = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # 上下文
    reply_to: Optional[str] = None      # 回复的消息 ID
    thread_id: Optional[str] = None     # 对话线程 ID
    round: int = 0                      # 辩论轮次
    
    # 时间戳
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        normalized_content = _normalize_content(self.content)
        return {
            "id": self.id,
            "sender": self.sender,
            "receiver": self.receiver,
            "type": self.message_type.value,
            "priority": self.priority.value,
            "content": normalized_content,
            "metadata": self.metadata,
            "reply_to": self.reply_to,
            "thread_id": self.thread_id,
            "round": self.round,
            "timestamp": self.timestamp.isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentMessage":
        return cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            sender=data.get("sender", ""),
            receiver=data.get("receiver", ""),
            message_type=MessageType(data.get("type", "inform")),
            priority=MessagePriority(data.get("priority", 2)),
            content=data.get("content", ""),
            metadata=data.get("metadata", {}),
            reply_to=data.get("reply_to"),
            thread_id=data.get("thread_id"),
            round=data.get("round", 0),
        )
    
    def create_reply(
        self, 
        content: Union[str, Dict[str, Any]],
        message_type: MessageType = None
    ) -> "AgentMessage":
        """创建回复消息"""
        return AgentMessage(
            sender=self.receiver,
            receiver=self.sender,
            message_type=message_type or MessageType.RESPONSE,
            content=content,
            reply_to=self.id,
            thread_id=self.thread_id or self.id,
            round=self.round,
        )


# 预定义的消息模板
class MessageTemplates:
    """消息模板"""
    
    @staticmethod
    def argument(sender: str, content: str, round: int) -> AgentMessage:
        """论点消息"""
        return AgentMessage(
            sender=sender,
            message_type=MessageType.ARGUMENT,
            content=MessagePayload(
                role="debater",
                action="argument",
                result=content
            ),
            round=round,
        )
    
    @staticmethod
    def rebuttal(
        sender: str, 
        content: str, 
        target_message_id: str,
        round: int
    ) -> AgentMessage:
        """反驳消息"""
        return AgentMessage(
            sender=sender,
            message_type=MessageType.REBUTTAL,
            content=MessagePayload(
                role="debater",
                action="rebuttal",
                result=content
            ),
            reply_to=target_message_id,
            round=round,
        )
    
    @staticmethod
    def evaluation(
        sender: str,
        receiver: str,
        scores: Dict[str, int],
        commentary: str,
        round: int
    ) -> AgentMessage:
        """评估消息"""
        return AgentMessage(
            sender=sender,
            receiver=receiver,
            message_type=MessageType.EVALUATION,
            content=MessagePayload(
                role="jury",
                action="evaluate",
                result=commentary,
                score=scores
            ),
            round=round,
        )
    
    @staticmethod
    def verdict(
        sender: str,
        winner: str,
        pro_score: int,
        con_score: int,
        summary: str
    ) -> AgentMessage:
        """裁决消息"""
        return AgentMessage(
            sender=sender,
            message_type=MessageType.VERDICT,
            priority=MessagePriority.HIGH,
            content=MessagePayload(
                role="jury",
                action="verdict",
                result=summary,
                score={
                    "winner": winner,
                    "pro_score": pro_score,
                    "con_score": con_score
                }
            ),
        )
    
    @staticmethod
    def request(
        sender: str,
        receiver: str,
        action: str,
        params: Dict[str, Any] = None
    ) -> AgentMessage:
        """请求消息"""
        return AgentMessage(
            sender=sender,
            receiver=receiver,
            message_type=MessageType.REQUEST,
            content=MessagePayload(
                role="system",
                action=action,
                result=params or {}
            ),
        )
    
    @staticmethod
    def status(sender: str, status: str, details: Dict[str, Any] = None) -> AgentMessage:
        """状态消息"""
        return AgentMessage(
            sender=sender,
            message_type=MessageType.STATUS,
            content=MessagePayload(
                role="system",
                action="status",
                result={
                    "status": status,
                    "details": details or {},
                }
            ),
        )


class MessageBus:
    """消息总线
    
    管理 Agent 间的消息传递：
    - 消息发布和订阅
    - 消息路由
    - 消息历史
    """
    
    def __init__(self):
        self.messages: List[AgentMessage] = []
        self.subscribers: Dict[str, List[Callable[[AgentMessage], None]]] = {}
        self._message_handlers: Dict[MessageType, List[Callable]] = {}
    
    def subscribe(
        self, 
        agent_id: str, 
        handler: Callable[[AgentMessage], None]
    ) -> None:
        """订阅消息
        
        Args:
            agent_id: Agent ID
            handler: 消息处理回调
        """
        if agent_id not in self.subscribers:
            self.subscribers[agent_id] = []
        self.subscribers[agent_id].append(handler)
    
    def unsubscribe(self, agent_id: str) -> None:
        """取消订阅"""
        if agent_id in self.subscribers:
            del self.subscribers[agent_id]
    
    def register_handler(
        self, 
        message_type: MessageType, 
        handler: Callable[[AgentMessage], None]
    ) -> None:
        """注册消息类型处理器"""
        if message_type not in self._message_handlers:
            self._message_handlers[message_type] = []
        self._message_handlers[message_type].append(handler)
    
    def publish(self, message: AgentMessage) -> None:
        """发布消息
        
        如果有接收者，发送给特定 Agent
        否则广播给所有订阅者
        """
        self.messages.append(message)
        
        # 类型处理器
        if message.message_type in self._message_handlers:
            for handler in self._message_handlers[message.message_type]:
                try:
                    handler(message)
                except Exception as e:
                    print(f"[MessageBus] Handler error: {e}")
        
        # Agent 订阅处理
        if message.receiver:
            # 定向消息
            if message.receiver in self.subscribers:
                for handler in self.subscribers[message.receiver]:
                    try:
                        handler(message)
                    except Exception as e:
                        print(f"[MessageBus] Subscriber error: {e}")
        else:
            # 广播消息
            for agent_id, handlers in self.subscribers.items():
                if agent_id != message.sender:  # 不发给自己
                    for handler in handlers:
                        try:
                            handler(message)
                        except Exception as e:
                            print(f"[MessageBus] Broadcast error: {e}")
    
    def get_messages(
        self,
        sender: str = None,
        receiver: str = None,
        message_type: MessageType = None,
        round: int = None,
        limit: int = None
    ) -> List[AgentMessage]:
        """获取消息
        
        支持多条件过滤
        """
        result = self.messages
        
        if sender:
            result = [m for m in result if m.sender == sender]
        if receiver:
            result = [m for m in result if m.receiver == receiver or m.receiver == ""]
        if message_type:
            result = [m for m in result if m.message_type == message_type]
        if round is not None:
            result = [m for m in result if m.round == round]
        
        if limit:
            result = result[-limit:]
        
        return result
    
    def get_thread(self, thread_id: str) -> List[AgentMessage]:
        """获取对话线程"""
        return [m for m in self.messages if m.thread_id == thread_id or m.id == thread_id]
    
    def get_conversation_between(
        self, 
        agent1: str, 
        agent2: str
    ) -> List[AgentMessage]:
        """获取两个 Agent 之间的对话"""
        return [
            m for m in self.messages
            if (m.sender == agent1 and m.receiver == agent2) or
               (m.sender == agent2 and m.receiver == agent1)
        ]
    
    def clear(self) -> None:
        """清空消息"""
        self.messages = []
    
    def export_history(self) -> List[Dict[str, Any]]:
        """导出消息历史"""
        return [m.to_dict() for m in self.messages]


class ProtocolValidator:
    """协议验证器
    
    验证消息是否符合通信协议规范
    """
    
    REQUIRED_FIELDS = {"sender", "message_type", "content"}
    
    @classmethod
    def validate(cls, message: AgentMessage) -> tuple[bool, str]:
        """验证消息
        
        Returns:
            (is_valid, error_message)
        """
        # 检查必填字段
        if not message.sender:
            return False, "Missing sender"
        
        if not message.content:
            return False, "Missing content"
        
        # 检查消息类型特定规则
        normalized = _normalize_content(message.content)
        raw_content = message.content if isinstance(message.content, dict) else {}

        if message.message_type == MessageType.REBUTTAL:
            if not message.reply_to:
                return False, "Rebuttal must have reply_to"
        
        if message.message_type == MessageType.EVALUATION:
            scores = normalized.get("score") or raw_content.get("scores")
            if scores is None:
                return False, "Evaluation must have score"
        
        if message.message_type == MessageType.VERDICT:
            score = normalized.get("score") or raw_content
            required = {"winner", "pro_score", "con_score"}
            if not isinstance(score, dict) or not required.issubset(score.keys()):
                missing = required - set(score.keys()) if isinstance(score, dict) else required
                return False, f"Verdict missing fields: {missing}"
        
        return True, ""
    
    @classmethod
    def validate_and_raise(cls, message: AgentMessage) -> None:
        """验证消息，失败时抛出异常"""
        is_valid, error = cls.validate(message)
        if not is_valid:
            raise ValueError(f"Invalid message: {error}")
