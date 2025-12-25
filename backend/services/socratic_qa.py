"""
苏格拉底式问答服务 (Socratic QA)

通过引导式提问帮助用户深入思考，而不是直接给出答案。
同时提供结构化的知识输出。
"""

from typing import Dict, Any, List, Optional, Generator
from dataclasses import dataclass, field
from services.ai_client import AIClient
import json


@dataclass
class SocraticResponse:
    """苏格拉底式回复"""
    # 引导性问题
    guiding_questions: List[str] = field(default_factory=list)
    # 启发性提示
    hints: List[str] = field(default_factory=list)
    # 核心概念解释（简短）
    core_explanation: str = ""
    # 思考框架
    thinking_framework: str = ""
    # 相关概念
    related_concepts: List[str] = field(default_factory=list)
    # 深入探索方向
    explore_further: List[str] = field(default_factory=list)
    # 难度评估
    difficulty: str = "intermediate"  # beginner/intermediate/advanced


@dataclass
class StructuredAnswer:
    """结构化回答"""
    # 一句话答案
    short_answer: str = ""
    # 详细解释
    detailed_explanation: str = ""
    # 核心要点
    key_points: List[str] = field(default_factory=list)
    # 实际例子
    examples: List[str] = field(default_factory=list)
    # 常见误区
    common_misconceptions: List[str] = field(default_factory=list)
    # 相关领域
    related_topics: List[str] = field(default_factory=list)
    # 延伸阅读建议
    further_reading: List[str] = field(default_factory=list)
    # 难度
    difficulty: str = "intermediate"


class SocraticQAService:
    """苏格拉底式问答服务"""
    
    # 模式设置
    MODE_SOCRATIC = "socratic"  # 引导式
    MODE_STRUCTURED = "structured"  # 结构化
    MODE_HYBRID = "hybrid"  # 混合模式
    
    def __init__(self, ai_client: AIClient, mode: str = "hybrid"):
        self.ai_client = ai_client
        self.mode = mode
        self.conversation_history: List[Dict[str, str]] = []
        self.current_topic: str = ""
        self.understanding_level: int = 0  # 用户理解程度 0-100
    
    def _build_socratic_prompt(self, question: str) -> str:
        """构建苏格拉底式提问的提示"""
        history_context = ""
        if self.conversation_history:
            recent = self.conversation_history[-4:]
            history_context = "\n".join([
                f"{'用户' if msg['role'] == 'user' else 'AI'}: {msg['content']}"
                for msg in recent
            ])
        
        return f"""你是一位苏格拉底式的导师，通过提问引导学生思考，而不是直接给出答案。

【用户问题】
{question}

【对话历史】
{history_context if history_context else "(新对话)"}

【你的任务】
1. 不要直接回答问题
2. 通过 2-3 个引导性问题，帮助用户自己思考出答案
3. 给出 1-2 个小提示，但不要透露完整答案
4. 如果用户已经接近正确理解，可以给予确认和深化

请以 JSON 格式输出：
```json
{{
    "opening_remark": "一句简短的开场白，表示这是个好问题",
    "guiding_questions": [
        "引导性问题1（从基础概念出发）",
        "引导性问题2（引向核心理解）",
        "引导性问题3（可选，深入思考）"
    ],
    "hints": [
        "小提示1（不直接给答案）",
        "小提示2（可选）"
    ],
    "thinking_framework": "思考这个问题的框架或角度",
    "encouragement": "鼓励用户思考的话"
}}
```"""

    def _build_structured_prompt(self, question: str) -> str:
        """构建结构化回答的提示"""
        return f"""请对以下问题给出结构化的回答。

【问题】
{question}

请以 JSON 格式输出完整的结构化回答：
```json
{{
    "short_answer": "用一句话概括答案（30字以内）",
    "detailed_explanation": "详细解释（150-300字）",
    "key_points": [
        "核心要点1",
        "核心要点2",
        "核心要点3"
    ],
    "examples": [
        "具体例子1",
        "具体例子2"
    ],
    "common_misconceptions": [
        "常见误区1",
        "常见误区2"
    ],
    "related_topics": ["相关话题1", "相关话题2"],
    "further_reading": ["推荐阅读1", "推荐阅读2"],
    "difficulty": "beginner/intermediate/advanced"
}}
```"""

    def _parse_json_response(self, response: str, default: Dict) -> Dict:
        """解析 JSON 响应"""
        try:
            # 尝试提取 JSON
            if "```json" in response:
                start = response.find("```json") + 7
                end = response.find("```", start)
                json_str = response[start:end].strip()
            elif "```" in response:
                start = response.find("```") + 3
                end = response.find("```", start)
                json_str = response[start:end].strip()
            elif "{" in response:
                start = response.find("{")
                end = response.rfind("}") + 1
                json_str = response[start:end]
            else:
                return default
            
            return json.loads(json_str)
        except:
            return default

    def ask_socratic(self, question: str) -> Dict[str, Any]:
        """苏格拉底式提问"""
        prompt = self._build_socratic_prompt(question)
        
        messages = [
            {"role": "system", "content": "你是一位善于启发思考的苏格拉底式导师。"},
            {"role": "user", "content": prompt}
        ]
        
        response = self.ai_client.get_completion(messages, temperature=0.7)
        
        result = self._parse_json_response(response, {
            "opening_remark": "这是个很好的问题！让我们一起思考。",
            "guiding_questions": ["你觉得这个概念的核心是什么？"],
            "hints": ["试着从基础定义开始思考"],
            "thinking_framework": "可以从 What-Why-How 的角度思考",
            "encouragement": "相信你通过思考一定能理解！"
        })
        
        # 记录历史
        self.conversation_history.append({"role": "user", "content": question})
        self.conversation_history.append({
            "role": "assistant", 
            "content": result.get("opening_remark", "") + "\n" + "\n".join(result.get("guiding_questions", []))
        })
        
        return {
            "type": "socratic",
            "question": question,
            **result
        }

    def ask_structured(self, question: str) -> Dict[str, Any]:
        """结构化问答"""
        prompt = self._build_structured_prompt(question)
        
        messages = [
            {"role": "system", "content": "你是一位知识渊博的专家，善于给出结构清晰的回答。"},
            {"role": "user", "content": prompt}
        ]
        
        response = self.ai_client.get_completion(messages, temperature=0.5)
        
        result = self._parse_json_response(response, {
            "short_answer": "暂无简短回答",
            "detailed_explanation": response,
            "key_points": [],
            "examples": [],
            "related_topics": [],
            "difficulty": "intermediate"
        })
        
        return {
            "type": "structured",
            "question": question,
            **result
        }

    def ask_hybrid(self, question: str) -> Dict[str, Any]:
        """混合模式：先引导思考，再给结构化答案"""
        prompt = f"""请对以下问题进行苏格拉底式引导 + 结构化回答的混合回复。

【问题】
{question}

请以 JSON 格式输出：
```json
{{
    "socratic_part": {{
        "opening": "引导性开场白",
        "questions": ["引导问题1", "引导问题2"],
        "hints": ["提示1"]
    }},
    "structured_part": {{
        "short_answer": "一句话回答",
        "key_points": ["要点1", "要点2", "要点3"],
        "example": "一个具体例子",
        "related": ["相关话题1", "相关话题2"]
    }},
    "difficulty": "beginner/intermediate/advanced",
    "learning_path": "建议的学习路径"
}}
```"""
        
        messages = [
            {"role": "system", "content": "你既是苏格拉底式导师，也是知识专家。"},
            {"role": "user", "content": prompt}
        ]
        
        response = self.ai_client.get_completion(messages, temperature=0.6)
        
        result = self._parse_json_response(response, {
            "socratic_part": {"opening": "让我们一起思考这个问题", "questions": [], "hints": []},
            "structured_part": {"short_answer": "", "key_points": [], "example": "", "related": []},
            "difficulty": "intermediate",
            "learning_path": ""
        })
        
        return {
            "type": "hybrid",
            "question": question,
            **result
        }

    def ask(self, question: str) -> Dict[str, Any]:
        """根据模式回答问题"""
        if self.mode == self.MODE_SOCRATIC:
            return self.ask_socratic(question)
        elif self.mode == self.MODE_STRUCTURED:
            return self.ask_structured(question)
        else:
            return self.ask_hybrid(question)

    def stream_ask(self, question: str) -> Generator[Dict[str, Any], None, None]:
        """流式问答（用于实时显示）"""
        yield {"type": "thinking", "content": "正在分析问题..."}
        
        if self.mode == self.MODE_SOCRATIC:
            prompt = self._build_socratic_prompt(question)
            system = "你是一位善于启发思考的苏格拉底式导师。请直接用自然语言引导用户思考，不要输出JSON。先提出引导性问题，再给一些提示。"
        elif self.mode == self.MODE_STRUCTURED:
            prompt = f"请回答以下问题，分点阐述核心要点，并给出例子。问题：{question}"
            system = "你是一位知识渊博的专家。"
        else:
            prompt = f"""请用混合方式回答问题。
先提1-2个引导性问题让用户思考，
然后用"---"分隔，
再给出结构化的回答，包括核心要点和例子。

问题：{question}"""
            system = "你既善于启发思考，也善于系统讲解。"
        
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt}
        ]
        
        full_response = ""
        for chunk in self.ai_client.chat_stream(messages, temperature=0.7):
            full_response += chunk
            yield {
                "type": "content",
                "content": full_response,
                "is_complete": False
            }
        
        # 记录历史
        self.conversation_history.append({"role": "user", "content": question})
        self.conversation_history.append({"role": "assistant", "content": full_response})
        
        yield {
            "type": "complete",
            "content": full_response,
            "is_complete": True,
            "mode": self.mode
        }

    def follow_up(self, user_response: str) -> Dict[str, Any]:
        """处理用户的思考回复"""
        if not self.conversation_history:
            return self.ask(user_response)
        
        # 分析用户的理解程度
        analyze_prompt = f"""用户在回答引导问题后说："{user_response}"

之前的对话：
{chr(10).join([f"{'用户' if m['role']=='user' else 'AI'}: {m['content'][:100]}" for m in self.conversation_history[-4:]])}

请评估用户的理解程度（0-100），并决定下一步：
- 如果理解正确(>70)：给予肯定，深化理解
- 如果部分正确(30-70)：纠正误解，继续引导
- 如果需要帮助(<30)：给更多提示

请以 JSON 格式输出：
```json
{{
    "understanding_level": 50,
    "feedback": "对用户回答的反馈",
    "next_step": "continueGuiding/confirm/explain",
    "content": "具体的回复内容（引导问题或解释）"
}}
```"""
        
        messages = [
            {"role": "system", "content": "你是一位耐心的苏格拉底式导师。"},
            {"role": "user", "content": analyze_prompt}
        ]
        
        response = self.ai_client.get_completion(messages, temperature=0.6)
        result = self._parse_json_response(response, {
            "understanding_level": 50,
            "feedback": "让我们继续思考",
            "next_step": "continueGuiding",
            "content": "能再详细说说你的想法吗？"
        })
        
        self.understanding_level = result.get("understanding_level", 50)
        
        # 记录
        self.conversation_history.append({"role": "user", "content": user_response})
        self.conversation_history.append({"role": "assistant", "content": result.get("content", "")})
        
        return {
            "type": "follow_up",
            **result
        }


def create_socratic_qa(
    ai_client: AIClient,
    mode: str = "hybrid"
) -> SocraticQAService:
    """创建苏格拉底问答服务"""
    return SocraticQAService(ai_client, mode)
