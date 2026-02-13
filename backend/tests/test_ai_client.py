"""
AI 客户端测试
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_client import AIClient


class TestAIClientInit:
    """测试 AI 客户端初始化"""
    
    def test_deepseek_init(self):
        """测试 DeepSeek 初始化"""
        client = AIClient(
            provider="deepseek",
            model="deepseek-chat",
            api_key="test_key"
        )
        assert client.provider == "deepseek"
        assert client.model == "deepseek-chat"
        assert client.client is not None
    
    def test_openai_init(self):
        """测试 OpenAI 初始化"""
        client = AIClient(
            provider="openai",
            model="gpt-4",
            api_key="test_key"
        )
        assert client.provider == "openai"
        assert client.model == "gpt-4"
    
    def test_gemini_init(self):
        """测试 Gemini 初始化"""
        client = AIClient(
            provider="gemini",
            model="gemini-pro",
            api_key="test_key"
        )
        assert client.provider == "gemini"
        assert client.api_key == "test_key"
        assert client.client is None  # Gemini 延迟初始化
    
    def test_claude_init(self):
        """测试 Claude 初始化"""
        client = AIClient(
            provider="claude",
            model="claude-3-sonnet",
            api_key="test_key"
        )
        assert client.provider == "claude"
        assert client.api_key == "test_key"
        assert client.client is None  # Claude 延迟初始化
    
    def test_unsupported_provider(self):
        """测试不支持的提供商"""
        with pytest.raises(ValueError, match="不支持的提供商"):
            AIClient(provider="unknown_provider", model="test")


class TestMessageConversion:
    """测试消息格式转换"""
    
    def test_convert_messages_for_gemini(self):
        """测试 Gemini 消息格式转换"""
        client = AIClient(provider="gemini", api_key="test")
        messages = [
            {"role": "system", "content": "你是助手"},
            {"role": "user", "content": "你好"},
            {"role": "assistant", "content": "你好！"},
        ]
        result = client._convert_messages_for_gemini(messages)
        assert "系统指令：你是助手" in result
        assert "用户：你好" in result
        assert "助手：你好！" in result
    
    def test_convert_messages_for_claude(self):
        """测试 Claude 消息格式转换"""
        client = AIClient(provider="claude", api_key="test")
        messages = [
            {"role": "system", "content": "你是助手"},
            {"role": "user", "content": "你好"},
            {"role": "assistant", "content": "你好！"},
        ]
        system_prompt, claude_messages = client._convert_messages_for_claude(messages)
        
        assert system_prompt == "你是助手"
        assert len(claude_messages) == 2
        assert claude_messages[0] == {"role": "user", "content": "你好"}
        assert claude_messages[1] == {"role": "assistant", "content": "你好！"}


class TestMockReproducibility:
    """测试 Mock 可复现性"""
    
    def test_mock_same_seed_same_output(self):
        messages = [{"role": "user", "content": "reproducibility check"}]
        client_a = AIClient(provider="mock", model="mock", seed=123)
        client_b = AIClient(provider="mock", model="mock", seed=123)
        
        output_a = client_a.get_completion(messages, temperature=0.7)
        output_b = client_b.get_completion(messages, temperature=0.7)
        
        assert output_a == output_b
