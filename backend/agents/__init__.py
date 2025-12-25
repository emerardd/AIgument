"""
AIgument Multi-Agent 框架

提供真正的 Multi-Agent 辩论系统，包括：
- BaseAgent: Agent 抽象基类
- DebaterAgent: 辩论者 Agent（ReAct 推理）
- JuryAgent: 评审 Agent
- DebateOrchestrator: 辩论协调器
- Protocol: Agent 通信协议
"""

from .base_agent import BaseAgent, AgentState
from .debater_agent import DebaterAgent
from .jury_agent import JuryAgent
from .orchestrator import DebateOrchestrator
from .protocol import (
    AgentMessage,
    MessageType,
    MessagePriority,
    MessageTemplates,
    MessageBus,
    ProtocolValidator,
)

__all__ = [
    "BaseAgent",
    "AgentState",
    "DebaterAgent",
    "JuryAgent",
    "DebateOrchestrator",
    "AgentMessage",
    "MessageType",
    "MessagePriority",
    "MessageTemplates",
    "MessageBus",
    "ProtocolValidator",
]

