"""Schema migrations: fresh installs, legacy create_all databases and data moves."""

import json

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from database import Base, alembic_config, init_db


@pytest.fixture
def engine(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'app.db').as_posix()}")
    yield engine
    engine.dispose()


def test_fresh_database_matches_models(engine):
    init_db(engine)
    with engine.connect() as connection:
        diff = compare_metadata(MigrationContext.configure(connection, opts={"compare_type": False}), Base.metadata)
    assert diff == []


def test_upgrade_is_idempotent(engine):
    init_db(engine)
    init_db(engine)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0002"


def legacy_schema(engine):
    """Tables exactly as the pre-migration create_all produced them."""
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE session (id INTEGER PRIMARY KEY, session_type VARCHAR(20), topic VARCHAR(500),"
            " created_at DATETIME, updated_at DATETIME, settings JSON)"
        ))
        connection.execute(text(
            "CREATE TABLE message (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES session(id),"
            " role VARCHAR(50), content TEXT, created_at DATETIME, meta_info JSON)"
        ))
        connection.execute(text(
            "CREATE TABLE debate_records (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES session(id),"
            " topic VARCHAR(500) NOT NULL, total_rounds INTEGER, winner VARCHAR(10), pro_provider VARCHAR(50),"
            " pro_model VARCHAR(100), con_provider VARCHAR(50), con_model VARCHAR(100), jury_model VARCHAR(100),"
            " is_mixed INTEGER, total_score_pro FLOAT, total_score_con FLOAT, margin VARCHAR(20), trace JSON,"
            " graph JSON, verdict JSON, evaluations JSON, run_config JSON, created_at DATETIME, completed_at DATETIME)"
        ))


def insert_session(connection, session_id, session_type, settings):
    connection.execute(
        text("INSERT INTO session (id, session_type, topic, settings) VALUES (:id, :type, :topic, :settings)"),
        {"id": session_id, "type": session_type, "topic": f"topic {session_id}", "settings": json.dumps(settings)},
    )


TRACE = {
    "run_config": {"provider": "mock", "model": "m1", "mixed_model": False},
    "verdict": {"winner": "con", "pro_total_score": 6.5, "con_total_score": 7.5, "margin": "close"},
    "evaluations": [{"round": 1}],
}


def test_legacy_database_is_migrated(engine):
    legacy_schema(engine)
    with engine.begin() as connection:
        # debate with a record (GET stream path) and one without (old POST path)
        insert_session(connection, 1, "debate", {
            "rounds": 2, "status": "completed", "completed_at": "2026-10-01T10:00:00+00:00",
            "trace": TRACE, "final_state": {"state": "done"}, "provider": "mock",
        })
        connection.execute(text("INSERT INTO debate_records (session_id, topic, winner) VALUES (1, 'topic 1', 'con')"))
        insert_session(connection, 2, "debate", {"rounds": 2, "status": "completed", "trace": TRACE, "final_state": {"s": 2}})
        insert_session(connection, 3, "dialectic", {
            "status": "failed", "error": "boom", "dialectic_trace": {"rounds": []}, "dialectic_tree": {"nodes": [1]},
        })
        insert_session(connection, 4, "chat", {"provider": "mock"})  # no lifecycle keys at all
        insert_session(connection, 5, "dual_chat", {"status": "running"})

    init_db(engine)

    with engine.connect() as connection:
        rows = {row.id: row for row in connection.execute(text(
            "SELECT id, settings, status, error, completed_at, result FROM session"
        ))}
        records = {row.session_id: row for row in connection.execute(text(
            "SELECT session_id, winner, trace, final_state, total_rounds FROM debate_records"
        ))}

    for row in rows.values():
        settings = json.loads(row.settings)
        assert not {"status", "error", "completed_at", "trace", "final_state",
                    "dialectic_trace", "dialectic_tree"} & settings.keys()

    assert rows[1].status == "completed" and rows[1].completed_at.startswith("2026-10-01")
    assert json.loads(rows[1].settings) == {"rounds": 2, "provider": "mock"}
    assert json.loads(records[1].final_state) == {"state": "done"}
    assert json.loads(records[1].trace) == TRACE  # filled because the record had none

    assert records[2].winner == "con" and records[2].total_rounds == 2
    assert json.loads(records[2].final_state) == {"s": 2}

    assert (rows[3].status, rows[3].error) == ("failed", "boom")
    assert json.loads(rows[3].result) == {"trace": {"rounds": []}, "tree": {"nodes": [1]}}
    assert rows[4].status == "completed"
    assert rows[5].status == "running"

    columns = {column["name"] for column in inspect(engine).get_columns("session")}
    assert {"status", "error", "completed_at", "result"} <= columns


def test_downgrade_restores_settings(engine):
    legacy_schema(engine)
    with engine.begin() as connection:
        insert_session(connection, 1, "dialectic", {"status": "failed", "error": "boom", "dialectic_tree": {"n": 1}})
    init_db(engine)
    with engine.begin() as connection:
        command.downgrade(alembic_config(connection), "0001")
    with engine.connect() as connection:
        settings = json.loads(connection.execute(text("SELECT settings FROM session")).scalar())
    assert settings["status"] == "failed" and settings["error"] == "boom"
    assert settings["dialectic_tree"] == {"n": 1}
    assert "status" not in {column["name"] for column in inspect(engine).get_columns("session")}
