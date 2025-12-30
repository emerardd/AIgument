"""
日志配置模块

提供统一的日志管理，支持彩色输出和结构化日志
"""
import logging
import sys
from typing import Optional
from datetime import datetime


class ColoredFormatter(logging.Formatter):
    """彩色日志格式化器"""
    
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
    
    # 设置格式
    formatter = ColoredFormatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
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
