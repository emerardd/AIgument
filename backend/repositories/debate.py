"""Database transactions for a multi-agent debate run."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from models.debate_record import DebateRecord
from models.session import Message, Session
from utils.session_state import mark_session_status, merge_session_settings


class DebateRepository:
    def __init__(self, db: DBSession):
        self.db = db

    def create(self, topic: str, settings: dict) -> Session:
        session = Session(
            session_type="debate", topic=topic,
            settings={**settings, "mode": "multi-agent", "status": "running"},
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get(self, session_id: int) -> Session:
        return self.db.get(Session, session_id)

    def rollback(self) -> None:
        self.db.rollback()

    def save_argument(self, session: Session, event: dict) -> None:
        """Keep completed turns even if a later model call fails or is cancelled."""
        self.db.add(Message(
            session_id=session.id,
            role=event.get("name") or event.get("side") or "unknown",
            content=event.get("content") or "",
            meta_info={"round": event.get("round"), "side": event.get("side"), "mode": "multi-agent"},
        ))
        self.db.commit()

    def complete(self, session: Session, trace: dict, final_state: dict, total_rounds: int) -> None:
        """Commit the final session state and analysis record atomically."""
        run_config = trace["run_config"]
        verdict = trace.get("verdict") or {}
        merge_session_settings(session, {
            "rounds": total_rounds,
            "temperature": run_config.get("temperature"),
            "seed": run_config.get("seed"),
            "preset": run_config.get("preset"),
            "final_state": final_state, "trace": trace, "status": "completed",
        })
        self.db.add(DebateRecord(
            session_id=session.id, topic=session.topic, total_rounds=total_rounds,
            winner=verdict.get("winner"),
            pro_provider=run_config.get("pro_provider", run_config.get("provider")),
            pro_model=run_config.get("pro_model", run_config.get("model")),
            con_provider=run_config.get("con_provider", run_config.get("provider")),
            con_model=run_config.get("con_model", run_config.get("model")),
            jury_model=run_config.get("model"),
            is_mixed=int(bool(run_config.get("mixed_model"))),
            total_score_pro=verdict.get("pro_total_score", 0),
            total_score_con=verdict.get("con_total_score", 0),
            margin=verdict.get("margin"), trace=trace, verdict=verdict,
            evaluations=trace.get("evaluations"), run_config=run_config,
            completed_at=datetime.now(timezone.utc),
        ))
        self.db.commit()

    def terminate(self, session: Session, status: str, error: str | None = None) -> None:
        self.db.rollback()
        mark_session_status(session, status, error)
        self.db.commit()
