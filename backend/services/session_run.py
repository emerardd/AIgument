"""Lifecycle shared by every streamed run: session, persistence and terminal status.

Each mode supplies how to prepare its run, which events to persist and how to
finish. This class guarantees, for every mode:

- configuration errors surface before a session row is created;
- a ``complete`` event is only emitted after the final state is committed;
- an ``error`` event, an exception, or a stream that ends without ``complete``
  marks the session ``failed``;
- a closed generator or task cancellation marks the session ``cancelled``.
"""

import asyncio
from contextlib import aclosing
from typing import Any, AsyncIterator, Generic, TypeVar

from models.session import Session
from repositories.session_run import SessionRunRepository
from services.ai_client import AIClient
from utils import get_api_key
from utils.logger import get_logger

logger = get_logger(__name__)

RequestT = TypeVar("RequestT")
RepositoryT = TypeVar("RepositoryT", bound=SessionRunRepository)


class RunFailedError(RuntimeError):
    """The run reported an error or stopped before completing."""


class SessionRunService(Generic[RequestT, RepositoryT]):
    label = "Run"

    def __init__(self, repository: RepositoryT):
        self.repository = repository

    @staticmethod
    def client(provider: str, model: str, seed: int | None = None) -> AIClient:
        return AIClient(provider=provider, model=model, api_key=get_api_key(provider), seed=seed)

    # ---- hooks -------------------------------------------------------------

    async def prepare(self, request: RequestT) -> Any:
        """Build clients and the event source without touching the database."""
        raise NotImplementedError

    def open_session(self, request: RequestT, run: Any) -> Session:
        raise NotImplementedError

    def on_open(self, session: Session, run: Any) -> None:
        """Write anything that belongs to the run before streaming starts."""

    def events(self, run: Any) -> AsyncIterator[dict]:
        raise NotImplementedError

    def session_event(self, session: Session, run: Any) -> dict:
        return {"type": "session", "session_id": session.id}

    def persist(self, session: Session, run: Any, event: dict) -> None:
        """Store a finished piece of output (called before the event is emitted)."""

    def finish(self, session: Session, run: Any, event: dict) -> None:
        self.repository.complete(session)

    # ---- lifecycle ---------------------------------------------------------

    async def run(self, request: RequestT) -> AsyncIterator[dict]:
        session = None
        finished = False
        try:
            run = await self.prepare(request)
            session = self.open_session(request, run)
            self.on_open(session, run)
            yield self.session_event(session, run)

            async with aclosing(self.events(run)) as events:
                async for event in events:
                    event_type = event.get("type")
                    if event_type == "error":
                        raise RunFailedError(event.get("error") or event.get("message") or f"{self.label} failed")
                    if event_type == "complete":
                        self.finish(session, run, event)
                        finished = True
                        yield event
                        return
                    self.persist(session, run, event)
                    yield event
            raise RunFailedError(f"{self.label} ended without a completion event")
        except (asyncio.CancelledError, GeneratorExit):
            raise
        except Exception as exc:
            if session is not None:
                finished = True
                self._terminate(session, "failed", str(exc))
            else:
                self.repository.rollback()
            logger.exception("%s failed", self.label)
            raise
        finally:
            if session is not None and not finished:
                self._terminate(session, "cancelled")

    def _terminate(self, session: Session, status: str, error: str | None = None) -> None:
        try:
            self.repository.terminate(session, status, error)
        except Exception:
            self.repository.rollback()
            logger.exception("Unable to persist %s termination: %s", self.label, status)
