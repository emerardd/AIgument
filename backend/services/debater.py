"""
辩论者服务
"""
from typing import Generator, Union, Optional
from .ai_client import AIClient


class Debater:
    """辩论者类"""
    
    def __init__(
        self, 
        name: str, 
        system_prompt: str, 
        provider: str = "deepseek", 
        model: str = "deepseek-chat",
        api_key: Optional[str] = None,
        temperature: float = 0.7,
        seed: Optional[int] = None
    ):
        """
        初始化辩论者
        :param name: 辩论者名称（正方/反方）
        :param system_prompt: 系统提示词
        :param provider: API提供商
        :param model: 模型名称
        :param api_key: API密钥
        """
        self.name = name
        self.system_prompt = system_prompt
        self.provider = provider
        self.model = model
        self.temperature = temperature
        self.conversation_history: list[dict] = []
        self.client = AIClient(provider=provider, model=model, api_key=api_key, seed=seed)
    
    def _build_messages(self, opponent_message: str) -> list[dict]:
        """构建消息列表"""
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(self.conversation_history)
        messages.append({"role": "user", "content": opponent_message})
        return messages
    
    def generate_response(self, opponent_message: str) -> str:
        """生成非流式回应"""
        messages = self._build_messages(opponent_message)
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response_content = self.client.get_completion(messages, temperature=self.temperature)
                
                # 更新对话历史
                self.conversation_history.append({"role": "user", "content": opponent_message})
                self.conversation_history.append({"role": "assistant", "content": response_content})
                
                return response_content
            except Exception as e:
                print(f"[Debater] API调用失败 (尝试 {attempt + 1}/{max_retries}): {e}")
                if attempt == max_retries - 1:
                    raise
                import time
                time.sleep(1)
        
        return ""
    
    def stream_response(self, opponent_message: str) -> Generator[str, None, None]:
        """流式生成回应"""
        messages = self._build_messages(opponent_message)
        
        try:
            full_response = ""
            for content in self.client.chat_stream(messages, temperature=self.temperature):
                full_response += content
                yield content
            
            # 更新对话历史
            self.conversation_history.append({"role": "user", "content": opponent_message})
            self.conversation_history.append({"role": "assistant", "content": full_response})
            
        except Exception as e:
            print(f"[Debater] 流式API调用错误: {e}")
            raise
    
    def get_response(self, opponent_message: str, stream: bool = False) -> Union[str, Generator[str, None, None]]:
        """获取回应，支持流式和非流式"""
        if stream:
            return self.stream_response(opponent_message)
        else:
            return self.generate_response(opponent_message)
