"""
自定义异常类

提供统一的异常处理机制
"""
from typing import Optional, Any, Dict


class AIgumentException(Exception):
    """AIgument 基础异常类"""
    
    def __init__(
        self, 
        message: str, 
        code: str = "INTERNAL_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "error": self.code,
            "message": self.message,
            "details": self.details
        }


class DebateException(AIgumentException):
    """辩论相关异常"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="DEBATE_ERROR", details=details)


class AIClientException(AIgumentException):
    """AI 客户端异常"""
    
    def __init__(
        self, 
        message: str, 
        provider: str = "",
        model: str = "",
        details: Optional[Dict[str, Any]] = None
    ):
        extra_details = {"provider": provider, "model": model}
        if details:
            extra_details.update(details)
        super().__init__(message, code="AI_CLIENT_ERROR", details=extra_details)


class ValidationException(AIgumentException):
    """验证异常"""
    
    def __init__(self, message: str, field: str = "", details: Optional[Dict[str, Any]] = None):
        extra_details = {"field": field} if field else {}
        if details:
            extra_details.update(details)
        super().__init__(message, code="VALIDATION_ERROR", details=extra_details)


class SessionNotFoundException(AIgumentException):
    """会话不存在异常"""
    
    def __init__(self, session_id: int):
        super().__init__(
            f"Session {session_id} not found",
            code="SESSION_NOT_FOUND",
            details={"session_id": session_id}
        )


class ProviderNotSupportedException(AIgumentException):
    """不支持的提供商异常"""
    
    def __init__(self, provider: str):
        super().__init__(
            f"Provider '{provider}' is not supported",
            code="PROVIDER_NOT_SUPPORTED",
            details={"provider": provider}
        )


class APIKeyMissingException(AIgumentException):
    """API Key 缺失异常"""
    
    def __init__(self, provider: str):
        super().__init__(
            f"API key for '{provider}' is not configured",
            code="API_KEY_MISSING",
            details={"provider": provider}
        )
