"""
异常类测试
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from exceptions import (
    AIgumentException,
    DebateException,
    AIClientException,
    ValidationException,
    SessionNotFoundException,
    ProviderNotSupportedException,
    APIKeyMissingException,
)


class TestAIgumentException:
    """测试基础异常类"""
    
    def test_basic_exception(self):
        """测试基本异常创建"""
        exc = AIgumentException("Test error", code="TEST_ERROR")
        assert exc.message == "Test error"
        assert exc.code == "TEST_ERROR"
        assert exc.details == {}
    
    def test_exception_with_details(self):
        """测试带详情的异常"""
        exc = AIgumentException(
            "Test error",
            code="TEST_ERROR",
            details={"key": "value"}
        )
        assert exc.details == {"key": "value"}
    
    def test_to_dict(self):
        """测试转换为字典"""
        exc = AIgumentException("Test", code="TEST", details={"a": 1})
        result = exc.to_dict()
        assert result == {
            "error": "TEST",
            "message": "Test",
            "details": {"a": 1}
        }


class TestDebateException:
    """测试辩论异常"""
    
    def test_debate_exception(self):
        exc = DebateException("Debate failed")
        assert exc.code == "DEBATE_ERROR"
        assert exc.message == "Debate failed"


class TestAIClientException:
    """测试 AI 客户端异常"""
    
    def test_ai_client_exception(self):
        exc = AIClientException(
            "API call failed",
            provider="openai",
            model="gpt-4"
        )
        assert exc.code == "AI_CLIENT_ERROR"
        assert exc.details["provider"] == "openai"
        assert exc.details["model"] == "gpt-4"


class TestValidationException:
    """测试验证异常"""
    
    def test_validation_exception(self):
        exc = ValidationException("Invalid input", field="topic")
        assert exc.code == "VALIDATION_ERROR"
        assert exc.details["field"] == "topic"


class TestSessionNotFoundException:
    """测试会话不存在异常"""
    
    def test_session_not_found(self):
        exc = SessionNotFoundException(123)
        assert exc.code == "SESSION_NOT_FOUND"
        assert exc.details["session_id"] == 123
        assert "123" in exc.message


class TestProviderNotSupportedException:
    """测试不支持的提供商异常"""
    
    def test_provider_not_supported(self):
        exc = ProviderNotSupportedException("unknown_provider")
        assert exc.code == "PROVIDER_NOT_SUPPORTED"
        assert exc.details["provider"] == "unknown_provider"


class TestAPIKeyMissingException:
    """测试 API Key 缺失异常"""
    
    def test_api_key_missing(self):
        exc = APIKeyMissingException("openai")
        assert exc.code == "API_KEY_MISSING"
        assert exc.details["provider"] == "openai"
