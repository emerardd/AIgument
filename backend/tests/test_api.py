"""
API 路由测试
"""
import pytest
import sys
import os
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestHealthCheck:
    """测试健康检查端点"""
    
    def test_health_check(self, client):
        """测试健康检查返回正常"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
    
    def test_root(self, client):
        """测试根路由"""
        response = client.get("/")
        assert response.status_code == 200
        frontend_index = Path(__file__).resolve().parents[2] / "src" / "static" / "dist" / "index.html"

        if frontend_index.exists():
            assert "text/html" in response.headers["content-type"]
            assert "<div id=\"root\"></div>" in response.text
        else:
            data = response.json()
            assert "message" in data
            assert "version" in data
            assert "AIgument" in data["message"]


class TestHistoryAPI:
    """测试历史记录 API"""
    
    def test_get_history_empty(self, client):
        """测试空历史记录"""
        response = client.get("/api/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "history" in data
        assert "total" in data
        assert isinstance(data["history"], list)
        assert isinstance(data["total"], int)

    def test_get_history_includes_new_session_types(self, client, db_session):
        """测试历史记录支持新版会话类型"""
        from models.session import Session

        db_session.add_all([
            Session(session_type="dual_chat", topic="双角色测试"),
            Session(session_type="qa_socratic", topic="苏格拉底测试"),
        ])
        db_session.commit()

        dual_response = client.get("/api/history", params={"type": "dual_chat"})
        assert dual_response.status_code == 200
        dual_data = dual_response.json()
        assert dual_data["total"] == 1
        assert dual_data["history"][0]["type"] == "dual_chat"

        socratic_response = client.get("/api/history", params={"type": "qa_socratic"})
        assert socratic_response.status_code == 200
        socratic_data = socratic_response.json()
        assert socratic_data["total"] == 1
        assert socratic_data["history"][0]["type"] == "qa_socratic"


# 注意：以下测试需要 AI API Key，CI 中可能跳过
class TestDebateAPI:
    """测试辩论 API（需要 mock 或真实 API Key）"""
    
    @pytest.mark.skip(reason="需要真实 API Key")
    def test_debate_stream(self, client):
        """测试流式辩论"""
        response = client.get(
            "/api/debate/stream",
            params={
                "topic": "测试辩题",
                "rounds": 1,
                "provider": "deepseek"
            }
        )
        assert response.status_code == 200
