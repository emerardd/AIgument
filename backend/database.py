"""
数据库连接配置
"""
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from config import get_settings
from runtime import get_backend_dir

settings = get_settings()

# 创建数据库引擎
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()


def get_db():
    """获取数据库会话的依赖"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


MIGRATIONS_DIR = get_backend_dir() / "migrations"


def alembic_config(connection=None) -> Config:
    """Alembic config that works in development and in the PyInstaller bundle."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    if connection is not None:
        config.attributes["connection"] = connection
    return config


def init_db(bind=None):
    """Bring the database schema up to date.

    Databases created by the old ``create_all`` start without an alembic
    version; the baseline migration only creates missing tables, so the same
    upgrade path covers new and existing installs.
    """
    with (bind or engine).begin() as connection:
        command.upgrade(alembic_config(connection), "head")
