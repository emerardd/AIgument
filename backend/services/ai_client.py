"""
AI客户端封装
"""
from openai import OpenAI
from typing import Generator, Optional
import os
import sys
import httpx
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_settings


class AIClient:
    """统一的AI客户端封装"""
    
    def __init__(self, provider: str = "deepseek", model: str = "deepseek-chat", api_key: Optional[str] = None):
        self.provider = provider
        self.model = model
        
        settings = get_settings()
        timeout = httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=10.0)
        
        if provider == "deepseek":
            final_api_key = api_key or settings.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY")
            self.client = OpenAI(
                api_key=final_api_key,
                base_url=settings.deepseek_api_base,
                timeout=timeout
            )
        elif provider == "openai":
            final_api_key = api_key or settings.openai_api_key or os.getenv("OPENAI_API_KEY")
            self.client = OpenAI(
                api_key=final_api_key,
                base_url=settings.openai_api_base,
                timeout=timeout
            )
        else:
            raise ValueError(f"不支持的提供商: {provider}")
    
    def chat(
        self, 
        messages: list[dict], 
        temperature: float = 0.7, 
        max_tokens: int = 2000,
        stream: bool = False
    ):
        """发送聊天请求"""
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
        stream = self.chat(messages, temperature, max_tokens, stream=True)
        
        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    yield delta.content
    
    def get_completion(self, messages: list[dict], **kwargs) -> str:
        """获取完整回复（非流式）"""
        response = self.chat(messages, stream=False, **kwargs)
        return response.choices[0].message.content

