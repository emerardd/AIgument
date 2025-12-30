"""
Pytest Fixtures

提供测试共用的 fixtures
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import Base, get_db


# 测试数据库（内存 SQLite）
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """创建测试数据库会话"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """创建测试客户端"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def mock_ai_client(mocker):
    """Mock AI 客户端"""
    mock = mocker.patch('services.ai_client.AIClient')
    mock.return_value.get_completion.return_value = "This is a mock response."
    mock.return_value.chat_stream.return_value = iter(["This ", "is ", "streaming."])
    return mock


@pytest.fixture
def sample_debate_request():
    """示例辩论请求"""
    return {
        "topic": "人工智能是否会取代人类工作",
        "rounds": 2,
        "provider": "deepseek",
        "model": "deepseek-chat",
        "stream": False
    }
