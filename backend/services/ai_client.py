"""
AI客户端封装 - 支持多提供商

提供统一的 AI 调用接口，支持连接池复用
"""
from openai import OpenAI
from typing import Generator, Optional, Dict
import os
import sys
import httpx
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_settings


class AIClient:
    """统一的AI客户端封装，支持 DeepSeek, OpenAI, Gemini, Claude
    
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
    
    def __init__(self, provider: str = "deepseek", model: str = "deepseek-chat", api_key: Optional[str] = None):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        
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
        else:
            raise ValueError(f"不支持的提供商: {provider}")
    
    def chat(
        self, 
        messages: list[dict], 
        temperature: float = 0.7, 
        max_tokens: int = 2000,
        stream: bool = False
    ):
        """发送聊天请求（仅适用于OpenAI兼容的API）"""
        if self.provider in ["gemini", "claude"]:
            raise NotImplementedError(f"{self.provider} 不支持此方法，请使用 chat_stream 或 get_completion")
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream
        )
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
