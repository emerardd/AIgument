"""Canonical debate event model used to derive streams, traces, and storage."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class DebateEvent(BaseModel):
    """A normalized event in a debate run.

    Transient events are useful for live UI updates but are not part of the
    durable run history used for trace reconstruction.
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    round: int | None = None
    side: str | None = None
    role: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    transient: bool = False

    @classmethod
    def from_payload(
        cls,
        event_type: str,
        payload: dict[str, Any],
        *,
        transient: bool = False,
    ) -> "DebateEvent":
        return cls(
            type=event_type,
            payload=dict(payload),
            round=payload.get("round"),
            side=payload.get("side"),
            role=payload.get("role"),
            transient=transient,
        )

    def to_stream_payload(self) -> dict[str, Any]:
        data = dict(self.payload)
        data["type"] = self.type
        data["event_id"] = self.id
        data["timestamp"] = self.timestamp.isoformat()
        return data

    def to_trace_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "round": self.round,
            "side": self.side,
            "role": self.role,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
        }
