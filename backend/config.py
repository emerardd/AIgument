"""
配置管理模块
"""
import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

from runtime import get_database_path, get_env_file_candidates


DEFAULT_PROVIDER = "deepseek"
DEFAULT_MODEL = "deepseek-v4-flash"


for env_file in get_env_file_candidates():
    if env_file.exists():
        load_dotenv(env_file, override=False, encoding="utf-8")


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
    default_provider: str = DEFAULT_PROVIDER
    default_model: str = DEFAULT_MODEL
    
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
            db_path = get_database_path()
            self.database_url = f"sqlite:///{db_path.as_posix()}"


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

