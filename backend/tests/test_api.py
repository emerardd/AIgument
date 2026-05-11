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

    def test_get_history_rejects_unknown_type(self, client):
        """测试历史记录拒绝未知类型，避免拼写错误被静默吞掉"""
        response = client.get("/api/history", params={"type": "unknown"})
        assert response.status_code == 400

    def test_get_history_pagination(self, client, db_session):
        """测试历史记录分页元数据和偏移查询"""
        from models.session import Session

        db_session.add_all([
            Session(session_type="chat", topic=f"分页测试 {idx}")
            for idx in range(25)
        ])
        db_session.commit()

        first_page = client.get("/api/history", params={"limit": 10, "offset": 0})
        assert first_page.status_code == 200
        first_data = first_page.json()
        assert len(first_data["history"]) == 10
        assert first_data["total"] == 25
        assert first_data["limit"] == 10
        assert first_data["offset"] == 0
        assert first_data["has_more"] is True

        third_page = client.get("/api/history", params={"limit": 10, "offset": 20})
        assert third_page.status_code == 200
        third_data = third_page.json()
        assert len(third_data["history"]) == 5
        assert third_data["total"] == 25
        assert third_data["has_more"] is False

    def test_get_history_search_by_topic(self, client, db_session):
        """测试历史记录按主题搜索并兼容类型过滤"""
        from models.session import Session

        db_session.add_all([
            Session(session_type="chat", topic="机器学习入门"),
            Session(session_type="qa", topic="机器学习问答"),
            Session(session_type="chat", topic="远程办公讨论"),
        ])
        db_session.commit()

        response = client.get("/api/history", params={"q": "机器学习"})
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert {item["topic"] for item in data["history"]} == {"机器学习入门", "机器学习问答"}

        typed_response = client.get("/api/history", params={"q": "机器学习", "type": "qa"})
        assert typed_response.status_code == 200
        typed_data = typed_response.json()
        assert typed_data["total"] == 1
        assert typed_data["history"][0]["topic"] == "机器学习问答"

    def test_export_session_formats(self, client, db_session):
        """测试会话支持 JSON、Markdown 和纯文本导出"""
        from models.session import Session, Message

        session = Session(session_type="chat", topic="导出测试")
        db_session.add(session)
        db_session.flush()
        db_session.add_all([
            Message(session_id=session.id, role="user", content="你好"),
            Message(session_id=session.id, role="assistant", content="你好，有什么可以帮你？"),
        ])
        db_session.commit()

        json_response = client.get(f"/api/history/{session.id}/export", params={"format": "json"})
        assert json_response.status_code == 200
        assert "application/json" in json_response.headers["content-type"]
        json_data = json_response.json()
        assert json_data["topic"] == "导出测试"
        assert json_data["messages"][0]["content"] == "你好"

        markdown_response = client.get(f"/api/history/{session.id}/export", params={"format": "markdown"})
        assert markdown_response.status_code == 200
        assert "text/markdown" in markdown_response.headers["content-type"]
        assert "# 导出测试" in markdown_response.text
        assert "### 👤 用户" in markdown_response.text

        txt_response = client.get(f"/api/history/{session.id}/export", params={"format": "txt"})
        assert txt_response.status_code == 200
        assert "text/plain" in txt_response.headers["content-type"]
        assert "[用户]" in txt_response.text
        assert "你好，有什么可以帮你？" in txt_response.text

    def test_export_session_rejects_unknown_format(self, client, db_session):
        """测试导出接口拒绝未知格式，避免静默返回错误内容"""
        from models.session import Session

        session = Session(session_type="chat", topic="导出测试")
        db_session.add(session)
        db_session.commit()

        response = client.get(f"/api/history/{session.id}/export", params={"format": "docx"})
        assert response.status_code == 400


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


class TestStreamSessionLifecycle:
    """测试流式接口的参数校验和会话状态记录"""

    def test_agent_stream_rejects_invalid_round_count(self, client):
        response = client.get(
            "/api/debate/agent-stream",
            params={"topic": "测试辩题", "rounds": 0, "provider": "mock", "model": "mock"},
        )
        assert response.status_code == 422

    def test_stream_chat_marks_session_completed(self, client, db_session):
        from models.session import Session

        with client.stream(
            "GET",
            "/api/chat/stream",
            params={"message": "你好", "provider": "mock", "model": "mock"},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

        assert '"type": "complete"' in body
        session = db_session.query(Session).filter(Session.session_type == "chat").first()
        assert session is not None
        assert session.settings["status"] == "completed"


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
