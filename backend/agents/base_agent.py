"""
Agent 抽象基类

定义所有 Agent 的基本结构和接口，实现 ReAct 推理模式。
"""

from abc import ABC, abstractmethod
from typing import Any, Optional, List, Dict
from pydantic import BaseModel, Field
from datetime import datetime
import json


class AgentState(BaseModel):
    """Agent 状态模型
    
    存储 Agent 的身份信息、信念状态和目标。
    """
    name: str = Field(description="Agent 名称")
    role: str = Field(description="Agent 角色")
    beliefs: Dict[str, Any] = Field(default_factory=dict, description="Agent 信念库")
    goals: List[str] = Field(default_factory=list, description="Agent 目标列表")
    current_strategy: Optional[str] = Field(default=None, description="当前策略")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    
    class Config:
        arbitrary_types_allowed = True


class AgentMessage(BaseModel):
    """Agent 间通信消息"""
    id: str = Field(description="消息ID")
    sender: str = Field(description="发送者")
    receiver: str = Field(description="接收者")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")
    message_type: str = Field(description="消息类型: inform/request/challenge/rebut")
    content: Dict[str, Any] = Field(description="消息内容")
    reply_to: Optional[str] = Field(default=None, description="回复的消息ID")


class ThinkResult(BaseModel):
    """思考结果"""
    reasoning: str = Field(description="推理过程")
    analysis: Dict[str, Any] = Field(default_factory=dict, description="分析结果")
    next_action: str = Field(description="下一步行动")
    confidence: float = Field(default=0.5, ge=0, le=1, description="置信度")


class BaseAgent(ABC):
    """Agent 抽象基类
    
    实现 ReAct (Reasoning + Acting) 模式：
    1. Observe - 观察环境/接收信息
    2. Think - 推理分析
    3. Act - 执行动作
    """
    
    def __init__(self, name: str, role: str, ai_client):
        """初始化 Agent
        
        Args:
            name: Agent 名称
            role: Agent 角色
            ai_client: AI 客户端实例
        """
        self.state = AgentState(name=name, role=role)
        self.ai_client = ai_client
        self.memory: List[Dict[str, Any]] = []
        self.message_history: List[AgentMessage] = []
    
    @property
    def name(self) -> str:
        return self.state.name
    
    @property
    def role(self) -> str:
        return self.state.role
    
    def update_belief(self, key: str, value: Any) -> None:
        """更新 Agent 信念
        
        Args:
            key: 信念键
            value: 信念值
        """
        self.state.beliefs[key] = value
    
    def get_belief(self, key: str, default: Any = None) -> Any:
        """获取 Agent 信念
        
        Args:
            key: 信念键
            default: 默认值
            
        Returns:
            信念值
        """
        return self.state.beliefs.get(key, default)
    
    def add_goal(self, goal: str) -> None:
        """添加目标"""
        if goal not in self.state.goals:
            self.state.goals.append(goal)
    
    def set_strategy(self, strategy: str) -> None:
        """设置当前策略"""
        self.state.current_strategy = strategy
    
    def add_to_memory(self, event: Dict[str, Any]) -> None:
        """添加事件到记忆
        
        Args:
            event: 事件字典，包含 type, content, timestamp 等
        """
        event["timestamp"] = datetime.now().isoformat()
        self.memory.append(event)
    
    def get_recent_memory(self, n: int = 5) -> List[Dict[str, Any]]:
        """获取最近的记忆
        
        Args:
            n: 返回的记忆数量
            
        Returns:
            最近 n 条记忆
        """
        return self.memory[-n:] if self.memory else []
    
    @abstractmethod
    async def think(self, context: Dict[str, Any]) -> ThinkResult:
        """推理过程 - ReAct 模式的 Reasoning 阶段
        
        分析当前情况，决定下一步行动。
        
        Args:
            context: 上下文信息
            
        Returns:
            ThinkResult 包含推理过程和分析结果
        """
        pass
    
    @abstractmethod
    async def act(self, think_result: ThinkResult) -> str:
        """执行动作 - ReAct 模式的 Acting 阶段
        
        基于思考结果执行具体动作。
        
        Args:
            think_result: 思考结果
            
        Returns:
            执行结果
        """
        pass
    
    async def observe(self, observation: str, source: str = "environment") -> None:
        """观察环境/接收信息
        
        Args:
            observation: 观察到的内容
            source: 信息来源
        """
        self.add_to_memory({
            "type": "observation",
            "source": source,
            "content": observation
        })
    
    async def react(self, context: Dict[str, Any]) -> tuple[ThinkResult, str]:
        """完整的 ReAct 循环
        
        Args:
            context: 上下文信息
            
        Returns:
            (思考结果, 执行结果)
        """
        think_result = await self.think(context)
        action_result = await self.act(think_result)
        return think_result, action_result
    
    def _parse_json_response(self, response: str, default: Dict = None) -> Dict:
        """解析 JSON 响应
        
        Args:
            response: AI 响应文本
            default: 解析失败时的默认值
            
        Returns:
            解析后的字典
        """
        if default is None:
            default = {}
        
        try:
            # 尝试提取 JSON 块
            if "```json" in response:
                start = response.find("```json") + 7
                end = response.find("```", start)
                json_str = response[start:end].strip()
            elif "```" in response:
                start = response.find("```") + 3
                end = response.find("```", start)
                json_str = response[start:end].strip()
            else:
                json_str = response.strip()
            
            return json.loads(json_str)
        except json.JSONDecodeError:
            return default
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name}, role={self.role})"
