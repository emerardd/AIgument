"""Give lifecycle and results their own columns.

- session.status / error / completed_at replace the same keys in settings JSON
- session.result holds mode-specific results (dialectic trace and tree)
- debate_records.final_state holds the orchestrator state; the debate trace and
  final state no longer live in session.settings

Existing rows are migrated: debates that have a trace in settings but no
DebateRecord get one, so analysis and evaluation keep working for them.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-04
"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

session_table = sa.table(
    "session",
    sa.column("id", sa.Integer),
    sa.column("session_type", sa.String),
    sa.column("topic", sa.String),
    sa.column("settings", sa.JSON),
    sa.column("status", sa.String),
    sa.column("error", sa.Text),
    sa.column("completed_at", sa.DateTime(timezone=True)),
    sa.column("result", sa.JSON),
)
record_table = sa.table(
    "debate_records",
    sa.column("id", sa.Integer),
    sa.column("session_id", sa.Integer),
    sa.column("topic", sa.String),
    sa.column("total_rounds", sa.Integer),
    sa.column("winner", sa.String),
    sa.column("pro_provider", sa.String),
    sa.column("pro_model", sa.String),
    sa.column("con_provider", sa.String),
    sa.column("con_model", sa.String),
    sa.column("jury_model", sa.String),
    sa.column("is_mixed", sa.Integer),
    sa.column("total_score_pro", sa.Float),
    sa.column("total_score_con", sa.Float),
    sa.column("margin", sa.String),
    sa.column("trace", sa.JSON),
    sa.column("verdict", sa.JSON),
    sa.column("evaluations", sa.JSON),
    sa.column("run_config", sa.JSON),
    sa.column("final_state", sa.JSON),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("completed_at", sa.DateTime(timezone=True)),
)

LIFECYCLE_KEYS = ("status", "error", "completed_at")


def _parse_time(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _record_from_trace(session_row, settings: dict, trace: dict, final_state) -> dict:
    run_config = trace.get("run_config") or {}
    verdict = trace.get("verdict") or {}
    return {
        "session_id": session_row.id,
        "topic": session_row.topic or "",
        "total_rounds": settings.get("rounds"),
        "winner": verdict.get("winner"),
        "pro_provider": run_config.get("pro_provider", run_config.get("provider")),
        "pro_model": run_config.get("pro_model", run_config.get("model")),
        "con_provider": run_config.get("con_provider", run_config.get("provider")),
        "con_model": run_config.get("con_model", run_config.get("model")),
        "jury_model": run_config.get("model"),
        "is_mixed": int(bool(run_config.get("mixed_model"))),
        "total_score_pro": verdict.get("pro_total_score", 0),
        "total_score_con": verdict.get("con_total_score", 0),
        "margin": verdict.get("margin"),
        "trace": trace,
        "verdict": verdict,
        "evaluations": trace.get("evaluations"),
        "run_config": run_config,
        "final_state": final_state,
        "created_at": datetime.now(timezone.utc),
        "completed_at": None,
    }


def upgrade() -> None:
    with op.batch_alter_table("session") as batch:
        batch.add_column(sa.Column("status", sa.String(20), nullable=False, server_default="completed"))
        batch.add_column(sa.Column("error", sa.Text(), nullable=True))
        batch.add_column(sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("result", sa.JSON(), nullable=True))
        batch.create_index("ix_session_status", ["status"])
    with op.batch_alter_table("debate_records") as batch:
        batch.add_column(sa.Column("final_state", sa.JSON(), nullable=True))

    bind = op.get_bind()
    records = {
        row.session_id: row
        for row in bind.execute(sa.select(record_table.c.id, record_table.c.session_id, record_table.c.trace))
    }
    rows = bind.execute(sa.select(
        session_table.c.id, session_table.c.session_type, session_table.c.topic, session_table.c.settings,
    )).all()

    for row in rows:
        settings = dict(row.settings or {})
        values = {
            "status": settings.pop("status", None) or "completed",
            "error": settings.pop("error", None),
            "completed_at": _parse_time(settings.pop("completed_at", None)),
            "result": None,
        }

        if row.session_type == "dialectic":
            trace = settings.pop("dialectic_trace", None)
            tree = settings.pop("dialectic_tree", None)
            if trace is not None or tree is not None:
                values["result"] = {"trace": trace, "tree": tree}

        if row.session_type == "debate":
            trace = settings.pop("trace", None)
            final_state = settings.pop("final_state", None)
            record = records.get(row.id)
            if record is not None:
                updates = {"final_state": final_state}
                if not record.trace and trace:
                    updates["trace"] = trace
                bind.execute(record_table.update().where(record_table.c.id == record.id).values(**updates))
            elif trace:
                bind.execute(record_table.insert().values(**_record_from_trace(row, settings, trace, final_state)))

        values["settings"] = settings
        bind.execute(session_table.update().where(session_table.c.id == row.id).values(**values))


def downgrade() -> None:
    bind = op.get_bind()
    final_states = {
        row.session_id: row.final_state
        for row in bind.execute(sa.select(record_table.c.session_id, record_table.c.final_state))
    }
    traces = {
        row.session_id: row.trace
        for row in bind.execute(sa.select(record_table.c.session_id, record_table.c.trace))
    }
    rows = bind.execute(sa.select(
        session_table.c.id, session_table.c.session_type, session_table.c.settings,
        session_table.c.status, session_table.c.error, session_table.c.completed_at, session_table.c.result,
    )).all()
    for row in rows:
        settings = dict(row.settings or {})
        settings["status"] = row.status
        if row.error:
            settings["error"] = row.error
        if row.completed_at:
            settings["completed_at"] = row.completed_at.isoformat()
        if row.session_type == "dialectic" and row.result:
            settings["dialectic_trace"] = row.result.get("trace")
            settings["dialectic_tree"] = row.result.get("tree")
        if row.session_type == "debate" and row.id in traces:
            settings["trace"] = traces[row.id]
            settings["final_state"] = final_states.get(row.id)
        bind.execute(session_table.update().where(session_table.c.id == row.id).values(settings=settings))

    with op.batch_alter_table("debate_records") as batch:
        batch.drop_column("final_state")
    with op.batch_alter_table("session") as batch:
        batch.drop_index("ix_session_status")
        batch.drop_column("result")
        batch.drop_column("completed_at")
        batch.drop_column("error")
        batch.drop_column("status")
