"""Datetime serialization for API responses."""

from datetime import datetime, timezone


def to_iso(value: datetime | None) -> str | None:
    """ISO 8601 with an explicit offset.

    SQLite drops tzinfo, so stored UTC timestamps come back naive; without an
    offset browsers would read them as local time.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()
