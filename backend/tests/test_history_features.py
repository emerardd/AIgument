"""Startup recovery, timestamp serialization, history status and debate stats."""

from datetime import datetime

from models.debate_record import DebateRecord
from models.session import Session
from repositories.session_run import INTERRUPTED_ERROR, recover_interrupted_runs
from utils.timefmt import to_iso


def test_recover_marks_only_running_sessions(db_session):
    db_session.add_all([
        Session(session_type="debate", topic="a", status="running"),
        Session(session_type="dialectic", topic="b", status="running"),
        Session(session_type="debate", topic="c", status="completed"),
        Session(session_type="dual_chat", topic="d", status="failed", error="boom"),
    ])
    db_session.commit()

    assert recover_interrupted_runs(db_session) == 2
    rows = {s.topic: s for s in db_session.query(Session)}
    assert (rows["a"].status, rows["a"].error) == ("interrupted", INTERRUPTED_ERROR)
    assert rows["b"].status == "interrupted"
    assert rows["c"].status == "completed"
    assert (rows["d"].status, rows["d"].error) == ("failed", "boom")
    assert recover_interrupted_runs(db_session) == 0


def test_naive_timestamps_are_serialized_as_utc():
    assert to_iso(datetime(2026, 11, 4, 12, 0)) == "2026-11-04T12:00:00+00:00"
    assert to_iso(None) is None


def test_history_list_includes_status_and_offset_timestamps(client, db_session):
    db_session.add(Session(session_type="debate", topic="x", status="interrupted"))
    db_session.commit()
    item = client.get("/api/history").json()["history"][0]
    assert item["status"] == "interrupted"
    assert item["start_time"].endswith("+00:00")


def record(winner, pro=("openai", "gpt"), con=("deepseek", "ds"), mixed=True, scores=(30, 25)):
    return DebateRecord(
        session_id=1, topic="t", winner=winner,
        pro_provider=pro[0], pro_model=pro[1], con_provider=con[0], con_model=con[1],
        is_mixed=int(mixed), total_score_pro=scores[0], total_score_con=scores[1],
    )


def test_stats_leaderboard_counts_only_mixed_model_debates(client, db_session):
    session = Session(session_type="debate", topic="t", status="completed")
    db_session.add(session)
    db_session.commit()
    db_session.add_all([
        record("pro"),                                              # gpt beats ds
        record("con", scores=(20, 32)),                             # ds beats gpt
        record("pro", pro=("deepseek", "ds"), con=("openai", "gpt")),  # ds (pro) beats gpt
        record("tie"),
        record("pro", pro=("mock", "m"), con=("mock", "m"), mixed=False),  # same model: excluded
    ])
    db_session.commit()

    stats = client.get("/api/analysis/stats").json()
    assert stats["total_debates"] == 5
    assert (stats["pro_wins"], stats["con_wins"], stats["ties"]) == (3, 1, 1)
    assert stats["mixed_model_debates"] == 4
    assert stats["sessions_by_status"] == {"completed": 1}

    board = {row["model"]: row for row in stats["leaderboard"]}
    assert set(board) == {"openai/gpt", "deepseek/ds"}
    assert (board["deepseek/ds"]["wins"], board["deepseek/ds"]["losses"], board["deepseek/ds"]["ties"]) == (2, 1, 1)
    assert (board["openai/gpt"]["wins"], board["openai/gpt"]["losses"]) == (1, 2)
    assert board["deepseek/ds"]["win_rate"] == 0.5
    assert stats["leaderboard"][0]["model"] == "deepseek/ds"


def test_stats_empty_database(client):
    stats = client.get("/api/analysis/stats").json()
    assert stats["total_debates"] == 0
    assert stats["leaderboard"] == []
    assert stats["avg_score_pro"] is None
