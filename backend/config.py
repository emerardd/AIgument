"""
配置管理模块
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""
    
    # API Keys
    deepseek_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    claude_api_key: str = ""
    
    # API Base URLs
    deepseek_api_base: str = "https://api.deepseek.com/v1"
    openai_api_base: str = "https://api.openai.com/v1"
    
    # 默认配置
    default_provider: str = "deepseek"
    default_model: str = "deepseek-chat"
    
    # 数据库
    database_url: str = ""
    
    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 如果数据库URL未设置，使用默认SQLite路径
        if not self.database_url:
            instance_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "instance")
            os.makedirs(instance_dir, exist_ok=True)
            self.database_url = f"sqlite:///{os.path.join(instance_dir, 'aigument.db')}"


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


# 运行配置预设
RUN_CONFIG_PRESETS = {
    "basic": {
        "temperature": 0.6,
        "seed": 42,
        "max_rounds": 3,
        "description": "基础配置，均衡质量与成本"
    },
    "quality": {
        "temperature": 0.85,
        "seed": 42,
        "max_rounds": 5,
        "description": "高质量配置，偏创造性与深度"
    },
    "budget": {
        "temperature": 0.4,
        "seed": 42,
        "max_rounds": 2,
        "description": "低成本配置，快速出结果"
    }
}


# 模型成本（静态估算，单位 USD / 1K tokens）
MODEL_PRICING = {
    "deepseek-chat": {"prompt": 0.0005, "completion": 0.0010},
    "gpt-4.1": {"prompt": 0.01, "completion": 0.03},
    "gpt-5": {"prompt": 0.02, "completion": 0.06},
    "gemini-2.5-pro": {"prompt": 0.01, "completion": 0.03},
    "claude-opus-4.5": {"prompt": 0.015, "completion": 0.05},
    "mock": {"prompt": 0.0, "completion": 0.0}
}
