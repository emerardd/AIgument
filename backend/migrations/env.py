"""Alembic environment.

The app runs migrations programmatically from ``database.init_db`` and passes
its own connection; the ``alembic`` CLI (see ``backend/alembic.ini``) falls back
to the configured database URL.
"""
import os
import sys

from alembic import context
from sqlalchemy import create_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base  # noqa: E402
import models.session  # noqa: E402,F401
import models.debate_record  # noqa: E402,F401

config = context.config
target_metadata = Base.metadata


def _configure(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # SQLite needs batch mode for ALTER TABLE
        compare_type=True,
    )


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _configure(connection)
        with context.begin_transaction():
            context.run_migrations()
        return

    from config import get_settings

    url = config.get_main_option("sqlalchemy.url") or get_settings().database_url
    engine = create_engine(url)
    with engine.connect() as connection:
        _configure(connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
