"""
双角色对话服务 (Dual Character Chat)

两个 AI 角色基于主题进行自然对话，用户作为旁观者。
"""

from typing import Dict, Any, List, Optional, Generator
from dataclasses import dataclass
from services.ai_client import AIClient
import json


@dataclass
class ChatRole:
    """对话角色"""
    name: str
    persona: str  # 角色人设
    speaking_style: str  # 说话风格
    position: str  # 对某话题的立场/观点倾向


# 预设角色模板
ROLE_TEMPLATES = {
    "乐观主义者": ChatRole(
        name="小阳",
        persona="一个积极乐观的人，总是看到事物好的一面",
        speaking_style="热情、鼓励性的语气，喜欢用正面词汇",
        position="支持、积极看待"
    ),
    "现实主义者": ChatRole(
        name="老陈",
        persona="一个务实理性的人，注重分析实际情况",
        speaking_style="冷静、客观的语气，喜欢用数据和事实",
        position="中立分析、权衡利弊"
    ),
    "怀疑论者": ChatRole(
        name="阿疑",
        persona="一个善于质疑的人，总是会提出不同看法",
        speaking_style="谨慎、批判性的语气，喜欢用反问",
        position="质疑、提出潜在问题"
    ),
    "创意者": ChatRole(
        name="小创",
        persona="一个富有想象力的人，总能提出新奇想法",
        speaking_style="活泼、跳跃性的思维，喜欢用比喻",
        position="创新、发散思考"
    ),
    "实践者": ChatRole(
        name="老王",
        persona="一个注重实践的人，关心如何落地执行",
        speaking_style="直接、具体的语气，喜欢讲实际案例",
        position="关注可行性、执行细节"
    ),
    "哲学家": ChatRole(
        name="孔思",
        persona="一个善于思考的人，喜欢探讨深层含义",
        speaking_style="深沉、思辨的语气，喜欢引用名言",
        position="追问本质、探索意义"
    ),
}


class DualChatService:
    """双角色对话服务"""
    
    def __init__(
        self,
        ai_client: AIClient,
        role_a: ChatRole,
        role_b: ChatRole,
        topic: str
    ):
        self.ai_client = ai_client
        self.role_a = role_a
        self.role_b = role_b
        self.topic = topic
        self.conversation_history: List[Dict[str, str]] = []
    
    def _build_role_prompt(self, role: ChatRole, is_initiator: bool = False) -> str:
        """构建角色系统提示"""
        return f"""你正在扮演一个名叫"{role.name}"的角色进行对话。

【角色设定】
- 人设：{role.persona}
- 说话风格：{role.speaking_style}
- 对话题的态度：{role.position}

【对话主题】
{self.topic}

【要求】
1. 完全代入角色，用第一人称说话
2. 回复控制在 50-100 字左右
3. 自然地接续对话，可以回应对方观点
4. 保持角色的说话风格和立场
5. 不要说"作为{role.name}"这样的元描述
6. 可以提问、分享观点、表达情感
"""
    
    def _build_response_prompt(
        self, 
        role: ChatRole, 
        last_message: str,
        speaker_name: str
    ) -> str:
        """构建回复提示"""
        history_text = ""
        if self.conversation_history:
            recent = self.conversation_history[-6:]  # 最近6条
            history_text = "\n".join([
                f"{msg['speaker']}: {msg['content']}"
                for msg in recent
            ])
        
        return f"""【对话历史】
{history_text if history_text else "(对话刚开始)"}

【{speaker_name}刚说】
{last_message}

请以"{role.name}"的身份回复，继续这个对话。直接输出你的回复内容，不要包含角色名称前缀。"""
    
    def get_opening(self) -> Dict[str, Any]:
        """获取开场白"""
        prompt = f"""请以"{self.role_a.name}"的身份，针对话题"{self.topic}"发起对话。
用一两句话自然地开始聊天，可以分享你对这个话题的看法或提一个问题。
直接输出对话内容，不要包含角色名称前缀。"""
        
        messages = [
            {"role": "system", "content": self._build_role_prompt(self.role_a, is_initiator=True)},
            {"role": "user", "content": prompt}
        ]
        
        response = self.ai_client.get_completion(messages, temperature=0.9)
        
        self.conversation_history.append({
            "speaker": self.role_a.name,
            "role_id": "a",
            "content": response
        })
        
        return {
            "speaker": self.role_a.name,
            "role_id": "a",
            "content": response,
            "turn": 1
        }
    
    def get_response(self, responding_role: str = "b") -> Dict[str, Any]:
        """获取回复
        
        Args:
            responding_role: "a" 或 "b"，表示哪个角色回复
        """
        if not self.conversation_history:
            return self.get_opening()
        
        role = self.role_b if responding_role == "b" else self.role_a
        other_role = self.role_a if responding_role == "b" else self.role_b
        
        last_msg = self.conversation_history[-1]
        
        messages = [
            {"role": "system", "content": self._build_role_prompt(role)},
            {"role": "user", "content": self._build_response_prompt(
                role, 
                last_msg["content"],
                last_msg["speaker"]
            )}
        ]
        
        response = self.ai_client.get_completion(messages, temperature=0.9)
        
        self.conversation_history.append({
            "speaker": role.name,
            "role_id": responding_role,
            "content": response
        })
        
        return {
            "speaker": role.name,
            "role_id": responding_role,
            "content": response,
            "turn": len(self.conversation_history)
        }
    
    def stream_response(self, responding_role: str = "b") -> Generator[Dict[str, Any], None, None]:
        """流式获取回复"""
        if not self.conversation_history:
            # 开场白 - 先发 message 事件，再发 message_complete
            result = self.get_opening()
            # 先发送流式消息（即使是完整内容）
            yield {
                "type": "message",
                "speaker": result["speaker"],
                "role_id": result["role_id"],
                "content": result["content"],
                "is_complete": False,
                "turn": result["turn"]
            }
            # 再发送完成事件
            yield {
                "type": "message_complete",
                "speaker": result["speaker"],
                "role_id": result["role_id"],
                "content": result["content"],
                "is_complete": True,
                "turn": result["turn"]
            }
            return
        
        role = self.role_b if responding_role == "b" else self.role_a
        last_msg = self.conversation_history[-1]
        
        messages = [
            {"role": "system", "content": self._build_role_prompt(role)},
            {"role": "user", "content": self._build_response_prompt(
                role, 
                last_msg["content"],
                last_msg["speaker"]
            )}
        ]
        
        full_response = ""
        for chunk in self.ai_client.chat_stream(messages, temperature=0.9):
            full_response += chunk
            yield {
                "type": "message",
                "speaker": role.name,
                "role_id": responding_role,
                "content": full_response,
                "is_complete": False,
                "turn": len(self.conversation_history) + 1
            }
        
        self.conversation_history.append({
            "speaker": role.name,
            "role_id": responding_role,
            "content": full_response
        })
        
        yield {
            "type": "message_complete",
            "speaker": role.name,
            "role_id": responding_role,
            "content": full_response,
            "is_complete": True,
            "turn": len(self.conversation_history)
        }
    
    def run_conversation(self, turns: int = 6) -> Generator[Dict[str, Any], None, None]:
        """运行完整对话
        
        Args:
            turns: 对话轮次（每轮包含双方各说一次）
        """
        yield {
            "type": "start",
            "topic": self.topic,
            "role_a": {"name": self.role_a.name, "persona": self.role_a.persona},
            "role_b": {"name": self.role_b.name, "persona": self.role_b.persona},
            "total_turns": turns
        }
        
        # 角色A开场
        for event in self.stream_response("a"):
            yield event
        
        # 交替对话
        for i in range(turns):
            # 角色B回复
            for event in self.stream_response("b"):
                yield event
            
            # 角色A回复（除了最后一轮）
            if i < turns - 1:
                for event in self.stream_response("a"):
                    yield event
        
        yield {
            "type": "complete",
            "total_messages": len(self.conversation_history),
            "history": self.conversation_history
        }
    
    def get_conversation_summary(self) -> str:
        """获取对话摘要"""
        if not self.conversation_history:
            return "对话尚未开始"
        
        prompt = f"""请简要总结以下对话的主要内容和观点交锋：

话题：{self.topic}

对话记录：
{chr(10).join([f"{msg['speaker']}: {msg['content']}" for msg in self.conversation_history])}

请用 2-3 句话概括。"""
        
        messages = [
            {"role": "system", "content": "你是一个善于总结的助手。"},
            {"role": "user", "content": prompt}
        ]
        
        return self.ai_client.get_completion(messages, temperature=0.5)


def create_dual_chat(
    ai_client: AIClient,
    topic: str,
    role_a_template: str = "乐观主义者",
    role_b_template: str = "现实主义者",
    custom_role_a: Dict[str, str] = None,
    custom_role_b: Dict[str, str] = None
) -> DualChatService:
    """创建双角色对话服务
    
    Args:
        ai_client: AI 客户端
        topic: 对话主题
        role_a_template: 角色A模板名称
        role_b_template: 角色B模板名称
        custom_role_a: 自定义角色A (可选)
        custom_role_b: 自定义角色B (可选)
    """
    if custom_role_a:
        role_a = ChatRole(**custom_role_a)
    else:
        role_a = ROLE_TEMPLATES.get(role_a_template, ROLE_TEMPLATES["乐观主义者"])
    
    if custom_role_b:
        role_b = ChatRole(**custom_role_b)
    else:
        role_b = ROLE_TEMPLATES.get(role_b_template, ROLE_TEMPLATES["现实主义者"])
    
    return DualChatService(ai_client, role_a, role_b, topic)
