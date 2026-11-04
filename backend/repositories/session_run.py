"""Database transactions shared by every streamed session run."""

from typing import Iterable

from sqlalchemy.orm import Session as DBSession

from models.session import Message, Session
from utils.session_state import mark_session_status, merge_session_settings


class SessionNotFoundError(LookupError):
    """The session to resume does not exist."""


class SessionTypeMismatchError(ValueError):
    """The session to resume belongs to another mode."""


class SessionRunRepository:
    def __init__(self, db: DBSession):
        self.db = db

    def start(self, session_type: str, topic: str, settings: dict) -> Session:
        session = Session(
            session_type=session_type, topic=topic[:500],
            settings=settings, status="running",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def resume(self, session_id: int, session_type: str, settings: dict) -> Session:
        session = self.get(session_id)
        if session is None:
            raise SessionNotFoundError(f"Session {session_id} not found")
        if session.session_type != session_type:
            raise SessionTypeMismatchError("Session type mismatch")
        merge_session_settings(session, settings)
        mark_session_status(session, "running")
        self.db.commit()
        return session

    def get(self, session_id: int) -> Session | None:
        return self.db.get(Session, session_id)

    def rollback(self) -> None:
        self.db.rollback()

    @staticmethod
    def _message(session: Session, role: str, content: str, meta: dict | None) -> Message:
        return Message(session_id=session.id, role=role, content=content or "", meta_info=meta)

    def add_message(self, session: Session, role: str, content: str, meta: dict | None = None) -> None:
        """Commit one finished message so later failures cannot lose it."""
        self.db.add(self._message(session, role, content, meta))
        self.db.commit()

    def complete(
        self,
        session: Session,
        result: dict | None = None,
        messages: Iterable[tuple[str, str, dict | None]] = (),
    ) -> None:
        """Commit final messages, the mode's result and completed status in one transaction."""
        for role, content, meta in messages:
            self.db.add(self._message(session, role, content, meta))
        if result is not None:
            session.result = result
        mark_session_status(session, "completed")
        self.db.commit()

    def terminate(self, session: Session, status: str, error: str | None = None) -> None:
        self.db.rollback()
        mark_session_status(session, status, error)
        self.db.commit()
