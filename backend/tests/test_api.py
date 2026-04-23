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


class TestDebateGraphAPI:
    """测试辩论图谱 API"""

    def test_graph_ignores_non_debater_messages(self, client, db_session):
        from models.session import Session, Message

        session = Session(session_type="debate", topic="测试图谱")
        db_session.add(session)
        db_session.flush()
        db_session.add_all([
            Message(session_id=session.id, role="user", content="用户提问"),
            Message(session_id=session.id, role="assistant", content="系统说明"),
            Message(session_id=session.id, role="正方", content="正方观点"),
            Message(session_id=session.id, role="反方", content="反方观点"),
        ])
        db_session.commit()

        response = client.get(f"/api/debate/{session.id}/graph")
        assert response.status_code == 200
        data = response.json()
        assert data["scores"]["total_arguments"] == 2

    def test_graph_returns_error_when_no_debater_messages(self, client, db_session):
        from models.session import Session, Message

        session = Session(session_type="debate", topic="无辩手消息")
        db_session.add(session)
        db_session.flush()
        db_session.add_all([
            Message(session_id=session.id, role="user", content="只有用户消息"),
            Message(session_id=session.id, role="assistant", content="只有助手消息"),
        ])
        db_session.commit()

        response = client.get(f"/api/debate/{session.id}/graph")
        assert response.status_code == 200
        assert response.json() == {"error": "No debater messages in session"}


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
