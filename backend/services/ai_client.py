"""
AI客户端封装 - 支持多提供商

提供统一的 AI 调用接口，支持连接池复用
"""
from openai import OpenAI
from typing import Generator, Optional, Dict
import os
import sys
import httpx
import json
import hashlib
import random
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_settings


class AIClient:
    """统一的AI客户端封装，支持 DeepSeek, OpenAI, Gemini, Claude, Mock
    
    特性：
    - 连接池复用：相同配置的客户端将被复用
    - 超时配置：合理的超时设置
    - 多提供商支持：DeepSeek、OpenAI、Gemini、Claude
    """
    
    # 类级别连接池，复用 OpenAI 客户端
    _client_pool: Dict[str, OpenAI] = {}
    
    @classmethod
    def _get_pool_key(cls, provider: str, api_key: str, base_url: str = "") -> str:
        """生成连接池的键"""
        return f"{provider}:{api_key[:8]}:{base_url}"
    
    @classmethod
    def _get_or_create_client(
        cls, 
        provider: str, 
        api_key: str, 
        base_url: str,
        timeout: httpx.Timeout
    ) -> OpenAI:
        """获取或创建 OpenAI 客户端（连接池复用）"""
        pool_key = cls._get_pool_key(provider, api_key, base_url)
        
        if pool_key not in cls._client_pool:
            cls._client_pool[pool_key] = OpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=timeout
            )
        
        return cls._client_pool[pool_key]
    
    def __init__(
        self,
        provider: str = "deepseek",
        model: str = "deepseek-chat",
        api_key: Optional[str] = None,
        seed: Optional[int] = None
    ):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.seed = seed
        
        settings = get_settings()
        timeout = httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=10.0)
        
        if provider == "deepseek":
            final_api_key = api_key or settings.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY")
            self.client = self._get_or_create_client(
                provider, final_api_key, settings.deepseek_api_base, timeout
            )
        elif provider == "openai":
            final_api_key = api_key or settings.openai_api_key or os.getenv("OPENAI_API_KEY")
            self.client = self._get_or_create_client(
                provider, final_api_key, settings.openai_api_base, timeout
            )
        elif provider == "gemini":
            final_api_key = api_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
            self.api_key = final_api_key
            # Gemini 使用 google-genai SDK，在调用时初始化
            self.client = None
        elif provider == "claude":
            final_api_key = api_key or settings.claude_api_key or os.getenv("CLAUDE_API_KEY")
            self.api_key = final_api_key
            # Claude 使用 anthropic SDK，在调用时初始化
            self.client = None
        elif provider == "mock":
            self.client = None
        else:
            raise ValueError(f"不支持的提供商: {provider}")
    
    def chat(
        self, 
        messages: list[dict], 
        temperature: float = 0.7, 
        max_tokens: int = 2000,
        stream: bool = False,
        seed: Optional[int] = None
    ):
        """发送聊天请求（仅适用于OpenAI兼容的API）"""
        if self.provider in ["gemini", "claude"]:
            raise NotImplementedError(f"{self.provider} 不支持此方法，请使用 chat_stream 或 get_completion")
        final_seed = self.seed if seed is None else seed
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }
        if final_seed is not None:
            payload["seed"] = final_seed
        response = self.client.chat.completions.create(**payload)
        return response
    
    def chat_stream(
        self, 
        messages: list[dict], 
        temperature: float = 0.7, 
        max_tokens: int = 2000
    ) -> Generator[str, None, None]:
        """流式聊天请求"""
        if self.provider in ["deepseek", "openai"]:
            # OpenAI 兼容 API
            stream = self.chat(messages, temperature, max_tokens, stream=True)
            for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        yield delta.content
                        
        elif self.provider == "gemini":
            # Google Gemini API
            from google import genai
            client = genai.Client(api_key=self.api_key)
            
            # 转换消息格式
            contents = self._convert_messages_for_gemini(messages)
            
            for chunk in client.models.generate_content_stream(
                model=self.model,
                contents=contents
            ):
                if chunk.text:
                    yield chunk.text
                    
        elif self.provider == "claude":
            # Anthropic Claude API
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            
            # 分离系统提示和用户消息
            system_prompt, claude_messages = self._convert_messages_for_claude(messages)
            
            with client.messages.stream(
                model=self.model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=claude_messages
            ) as stream:
                for text in stream.text_stream:
                    yield text
        elif self.provider == "mock":
            content = self._mock_response(messages, temperature=temperature)
            for chunk in self._chunk_text(content):
                yield chunk
    
    def get_completion(self, messages: list[dict], **kwargs) -> str:
        """获取完整回复（非流式）"""
        if self.provider in ["deepseek", "openai"]:
            response = self.chat(messages, stream=False, **kwargs)
            return response.choices[0].message.content
            
        elif self.provider == "gemini":
            from google import genai
            client = genai.Client(api_key=self.api_key)
            contents = self._convert_messages_for_gemini(messages)
            response = client.models.generate_content(
                model=self.model,
                contents=contents
            )
            return response.text
            
        elif self.provider == "claude":
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            system_prompt, claude_messages = self._convert_messages_for_claude(messages)
            response = client.messages.create(
                model=self.model,
                max_tokens=kwargs.get("max_tokens", 2000),
                system=system_prompt,
                messages=claude_messages
            )
            return response.content[0].text
        elif self.provider == "mock":
            temperature = kwargs.get("temperature", 0.7)
            return self._mock_response(messages, temperature=temperature)
        
        return ""
    
    def _convert_messages_for_gemini(self, messages: list[dict]) -> str:
        """将消息格式转换为 Gemini 格式"""
        # Gemini 接受简单的字符串或 Content 对象
        # 这里简化处理，将所有消息拼接
        parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                parts.append(f"系统指令：{content}")
            elif role == "assistant":
                parts.append(f"助手：{content}")
            else:
                parts.append(f"用户：{content}")
        return "\n\n".join(parts)
    
    def _convert_messages_for_claude(self, messages: list[dict]) -> tuple[str, list[dict]]:
        """将消息格式转换为 Claude 格式"""
        system_prompt = ""
        claude_messages = []
        
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "system":
                system_prompt = content
            else:
                # Claude 只接受 user 和 assistant 角色
                claude_role = "assistant" if role == "assistant" else "user"
                claude_messages.append({"role": claude_role, "content": content})
        
        return system_prompt, claude_messages

    def _mock_response(self, messages: list[dict], temperature: float = 0.7) -> str:
        """生成可复现的 Mock 响应"""
        seed = self._derive_seed(messages, temperature)
        rng = random.Random(seed)
        prompt = messages[-1].get("content", "") if messages else ""
        prompt_str = prompt if isinstance(prompt, str) else json.dumps(prompt, ensure_ascii=False)

        if "pro_score" in prompt_str and "con_score" in prompt_str:
            return json.dumps(self._mock_round_evaluation(rng), ensure_ascii=False)
        if "opening_strategy" in prompt_str and "key_arguments" in prompt_str:
            return json.dumps(self._mock_opening_analysis(rng), ensure_ascii=False)
        if "selected_strategy" in prompt_str and "counter_points" in prompt_str:
            return json.dumps(self._mock_counter_analysis(rng), ensure_ascii=False)
        if "key_turning_points" in prompt_str and "winner" in prompt_str:
            return json.dumps(self._mock_final_verdict(rng), ensure_ascii=False)

        return self._mock_argument_text(rng)

    def _derive_seed(self, messages: list[dict], temperature: float) -> int:
        payload = json.dumps(messages, ensure_ascii=False, sort_keys=True)
        seed_base = self.seed if self.seed is not None else 0
        raw = f"{seed_base}|{temperature}|{self.model}|{payload}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return int(digest[:8], 16)

    def _mock_opening_analysis(self, rng: random.Random) -> Dict:
        return {
            "topic_analysis": "辩题涉及社会与技术变迁的边界，需要区分岗位替代与能力增强。",
            "core_stance": "技术将改变岗位形态而非完全替代人类价值。",
            "opening_strategy": "强调历史类比与人机协作的现实案例。",
            "key_arguments": [
                "技术替代的是任务而非整体职业",
                "协作模式会创造新岗位需求",
                "制度与教育会同步调整"
            ],
            "anticipated_opposition": [
                "自动化会导致大规模失业",
                "AI 成本低于人力"
            ],
            "confidence": round(rng.uniform(0.6, 0.85), 2)
        }

    def _mock_counter_analysis(self, rng: random.Random) -> Dict:
        return {
            "opponent_main_points": ["对方强调成本优势与效率提升"],
            "opponent_weaknesses": ["忽视再就业与产业结构调整的时间窗"],
            "selected_strategy": rng.choice(["direct_refute", "reframe", "counter_example"]),
            "strategy_reason": "选择可直接削弱对方核心假设的策略。",
            "counter_points": ["效率提升不等同于岗位消失", "历史上技术升级带来新需求"],
            "new_arguments": ["政策与教育可缓冲冲击"],
            "confidence": round(rng.uniform(0.55, 0.8), 2)
        }

    def _mock_round_evaluation(self, rng: random.Random) -> Dict:
        def score():
            return {
                "logic": rng.randint(5, 9),
                "evidence": rng.randint(5, 9),
                "rhetoric": rng.randint(5, 9),
                "rebuttal": rng.randint(5, 9)
            }

        pro_score = score()
        con_score = score()
        pro_total = sum(pro_score.values())
        con_total = sum(con_score.values())
        winner = "pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie")

        return {
            "pro_score": pro_score,
            "con_score": con_score,
            "round_winner": winner,
            "commentary": "双方论点清晰，正方在结构性分析上略胜一筹。",
            "highlights": ["结构化论证", "反驳切中要点"],
            "suggestions": {
                "pro": ["补充更多现实案例支撑论点"],
                "con": ["加强对反例的处理"]
            }
        }

    def _mock_final_verdict(self, rng: random.Random) -> Dict:
        winner = rng.choice(["pro", "con", "tie"])
        return {
            "winner": winner,
            "pro_total_score": rng.randint(60, 75),
            "con_total_score": rng.randint(58, 74),
            "margin": rng.choice(["decisive", "close", "marginal"]),
            "summary": "整体而言，双方论证充分，胜负取决于对关键假设的把握。",
            "pro_strengths": ["逻辑连贯", "结构完整"],
            "con_strengths": ["反驳直接", "案例贴近现实"],
            "key_turning_points": ["第二轮反驳质量差异", "总结陈词的结构性优势"]
        }

    def _mock_argument_text(self, rng: random.Random) -> str:
        templates = [
            "我们需要区分任务替代与职业替代。技术会提升效率，但更重要的是重构分工。",
            "历史上每次技术革命都会淘汰部分岗位，但也会催生新的价值链。",
            "关键不在于是否替代，而在于社会如何调整制度与教育以吸收冲击。"
        ]
        rng.shuffle(templates)
        return " ".join(templates)

    def _chunk_text(self, text: str, chunk_size: int = 24):
        for i in range(0, len(text), chunk_size):
            yield text[i:i + chunk_size]
