"""
DebateRecord 模型和 Analysis API 测试

覆盖 DebateRecord CRUD 和 /api/analysis 端点
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.debate_record import DebateRecord
from models.session import Session


class TestDebateRecordModel:
    """DebateRecord 模型基本功能"""

    def test_create_record(self, db_session):
        # 先创建 Session
        session = Session(session_type="debate", topic="测试辩题")
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        record = DebateRecord(
            session_id=session.id,
            topic="测试辩题",
            total_rounds=3,
            winner="pro",
            pro_provider="deepseek",
            pro_model="deepseek-chat",
            con_provider="openai",
            con_model="gpt-5-mini",
            is_mixed=1,
            total_score_pro=78.5,
            total_score_con=72.3,
            margin="close",
            trace={"turns": []},
            verdict={"winner": "pro", "summary": "正方胜"},
            evaluations=[{"round": 1, "round_winner": "pro"}],
            run_config={"provider": "deepseek"},
        )
        db_session.add(record)
        db_session.commit()
        db_session.refresh(record)

        assert record.id is not None
        assert record.session_id == session.id
        assert record.winner == "pro"
        assert record.is_mixed == 1

    def test_query_record(self, db_session):
        session = Session(session_type="debate", topic="查询测试")
        db_session.add(session)
        db_session.commit()

        record = DebateRecord(
            session_id=session.id,
            topic="查询测试",
            winner="con",
        )
        db_session.add(record)
        db_session.commit()

        found = db_session.query(DebateRecord).filter(
            DebateRecord.session_id == session.id
        ).first()
        assert found is not None
        assert found.winner == "con"

    def test_repr(self, db_session):
        session = Session(session_type="debate", topic="repr测试辩题这个很长的标题")
        db_session.add(session)
        db_session.commit()

        record = DebateRecord(
            session_id=session.id,
            topic="repr测试辩题这个很长的标题",
            winner="tie",
        )
        db_session.add(record)
        db_session.commit()
        db_session.refresh(record)

        r = repr(record)
        assert "DebateRecord" in r
        assert "tie" in r


class TestAnalysisAPI:
    """Analysis API 端点测试"""

    def test_get_stats_empty(self, client):
        response = client.get("/api/analysis/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_debates"] == 0

    def test_get_debate_not_found(self, client):
        response = client.get("/api/analysis/debate/99999")
        assert response.status_code == 404

    def test_get_debate_analysis(self, client, db_session):
        session = Session(session_type="debate", topic="API测试")
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        record = DebateRecord(
            session_id=session.id,
            topic="API测试",
            winner="pro",
            total_score_pro=80.0,
            total_score_con=70.0,
        )
        db_session.add(record)
        db_session.commit()

        response = client.get(f"/api/analysis/debate/{session.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["topic"] == "API测试"
        assert data["winner"] == "pro"
        assert data["total_score_pro"] == 80.0

    def test_get_stats_with_data(self, client, db_session):
        for i, winner in enumerate(["pro", "con", "tie"]):
            session = Session(session_type="debate", topic=f"统计测试{i}")
            db_session.add(session)
            db_session.commit()
            db_session.refresh(session)

            record = DebateRecord(
                session_id=session.id,
                topic=f"统计测试{i}",
                winner=winner,
                pro_model="deepseek-chat",
                con_model="gpt-5-mini",
            )
            db_session.add(record)
        db_session.commit()

        response = client.get("/api/analysis/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_debates"] == 3
        assert data["pro_wins"] == 1
        assert data["con_wins"] == 1
        assert data["ties"] == 1
