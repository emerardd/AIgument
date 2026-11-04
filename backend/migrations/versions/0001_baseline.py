"""Baseline schema (session, message, debate_records) as created by create_all.

Databases created before migrations existed already have some or all of these
tables, so each table is only created when missing.

Revision ID: 0001
Revises:
Create Date: 2026-11-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    tables = _existing_tables()

    if "session" not in tables:
        op.create_table(
            "session",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("session_type", sa.String(20)),
            sa.Column("topic", sa.String(500)),
            sa.Column("created_at", sa.DateTime(timezone=True)),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
            sa.Column("settings", sa.JSON()),
        )
        op.create_index("ix_session_id", "session", ["id"])
        op.create_index("ix_session_session_type", "session", ["session_type"])
        op.create_index("ix_session_created_at", "session", ["created_at"])

    if "message" not in tables:
        op.create_table(
            "message",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("session_id", sa.Integer(), sa.ForeignKey("session.id"), nullable=False),
            sa.Column("role", sa.String(50)),
            sa.Column("content", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True)),
            sa.Column("meta_info", sa.JSON()),
        )
        op.create_index("ix_message_id", "message", ["id"])
        op.create_index("ix_message_session_id", "message", ["session_id"])
        op.create_index("ix_message_created_at", "message", ["created_at"])

    if "debate_records" not in tables:
        op.create_table(
            "debate_records",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("session_id", sa.Integer(), sa.ForeignKey("session.id"), nullable=False),
            sa.Column("topic", sa.String(500), nullable=False),
            sa.Column("total_rounds", sa.Integer()),
            sa.Column("winner", sa.String(10)),
            sa.Column("pro_provider", sa.String(50)),
            sa.Column("pro_model", sa.String(100)),
            sa.Column("con_provider", sa.String(50)),
            sa.Column("con_model", sa.String(100)),
            sa.Column("jury_model", sa.String(100)),
            sa.Column("is_mixed", sa.Integer()),
            sa.Column("total_score_pro", sa.Float()),
            sa.Column("total_score_con", sa.Float()),
            sa.Column("margin", sa.String(20)),
            sa.Column("trace", sa.JSON()),
            sa.Column("graph", sa.JSON()),
            sa.Column("verdict", sa.JSON()),
            sa.Column("evaluations", sa.JSON()),
            sa.Column("run_config", sa.JSON()),
            sa.Column("created_at", sa.DateTime(timezone=True)),
            sa.Column("completed_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_debate_records_id", "debate_records", ["id"])
        op.create_index("ix_debate_records_session_id", "debate_records", ["session_id"])
        op.create_index("ix_debate_records_created_at", "debate_records", ["created_at"])


def downgrade() -> None:
    op.drop_table("debate_records")
    op.drop_table("message")
    op.drop_table("session")
