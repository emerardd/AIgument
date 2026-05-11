"""Helpers for safely updating JSON session settings."""

from typing import Any

from sqlalchemy.orm.attributes import flag_modified


def merge_session_settings(session: Any, updates: dict[str, Any]) -> None:
    """Merge settings updates and mark the JSON column as modified."""
    settings = dict(session.settings or {})
    settings.update(updates)
    session.settings = settings
    flag_modified(session, "settings")


def mark_session_status(session: Any, status: str, error: str | None = None) -> None:
    """Record lifecycle status for long-running streamed sessions."""
    updates: dict[str, Any] = {"status": status}
    if error:
        updates["error"] = error
    merge_session_settings(session, updates)
