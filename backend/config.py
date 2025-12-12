"""
配置管理模块
"""
import os
from pydantic_settings import BaseSettings
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
    
    class Config:
        env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"
    
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
