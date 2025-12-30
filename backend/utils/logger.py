"""
日志配置模块

提供统一的日志管理，支持彩色输出、结构化日志和请求追踪
"""
import logging
import sys
import uuid
from typing import Optional
from datetime import datetime
from contextvars import ContextVar

# 请求追踪 ID 上下文变量
request_id_var: ContextVar[str] = ContextVar('request_id', default='')


def generate_request_id() -> str:
    """生成请求追踪 ID"""
    return uuid.uuid4().hex[:12]


def set_request_id(request_id: str) -> str:
    """设置当前请求的追踪 ID"""
    request_id_var.set(request_id)
    return request_id


def get_request_id() -> str:
    """获取当前请求的追踪 ID"""
    return request_id_var.get()


class ColoredFormatter(logging.Formatter):
    """彩色日志格式化器，支持请求追踪 ID"""
    
    # ANSI 颜色代码
    COLORS = {
        'DEBUG': '\033[36m',     # 青色
        'INFO': '\033[32m',      # 绿色
        'WARNING': '\033[33m',   # 黄色
        'ERROR': '\033[31m',     # 红色
        'CRITICAL': '\033[35m',  # 紫色
    }
    RESET = '\033[0m'
    
    def format(self, record):
        # 添加颜色
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.RESET}"
        
        # 添加请求 ID
        request_id = get_request_id()
        if request_id:
            record.request_id = f"[{request_id}] "
        else:
            record.request_id = ""
        
        return super().format(record)


def get_logger(name: str, level: Optional[int] = None) -> logging.Logger:
    """
    获取配置好的 logger 实例
    
    Args:
        name: logger 名称，通常使用 __name__
        level: 日志级别，默认 INFO
        
    Returns:
        配置好的 Logger 实例
    """
    logger = logging.getLogger(name)
    
    # 避免重复添加 handler
    if logger.handlers:
        return logger
    
    # 设置级别
    logger.setLevel(level or logging.INFO)
    
    # 创建控制台 handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level or logging.INFO)
    
    # 设置格式（包含请求 ID）
    formatter = ColoredFormatter(
        fmt='%(asctime)s | %(levelname)-8s | %(request_id)s%(name)s | %(message)s',
        datefmt='%H:%M:%S'
    )
    console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    
    return logger


# 创建根 logger
root_logger = get_logger("aigument")


def log_request(method: str, path: str, status_code: int, duration_ms: float):
    """记录 HTTP 请求日志"""
    root_logger.info(f"{method} {path} - {status_code} ({duration_ms:.2f}ms)")


def log_ai_call(provider: str, model: str, tokens: int = 0, duration_ms: float = 0):
    """记录 AI API 调用日志"""
    root_logger.info(f"AI Call: {provider}/{model} - {tokens} tokens ({duration_ms:.2f}ms)")


def log_debate_event(session_id: int, event_type: str, details: str = ""):
    """记录辩论事件日志"""
    root_logger.info(f"Debate [{session_id}] {event_type}: {details}")
