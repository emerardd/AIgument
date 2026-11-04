"""Socratic QA run: new or resumed session, question saved up front, answer on completion."""

from dataclasses import dataclass

from repositories.session_run import SessionRunRepository
from schemas.session_runs import SocraticQARequest
from services.session_run import SessionRunService
from services.socratic_qa import SocraticQAService, create_socratic_qa


@dataclass
class SocraticRun:
    qa: SocraticQAService
    request: SocraticQARequest


class SocraticRunService(SessionRunService[SocraticQARequest, SessionRunRepository]):
    label = "Socratic QA run"
    session_type = "qa_socratic"

    async def prepare(self, request: SocraticQARequest) -> SocraticRun:
        qa = create_socratic_qa(self.client(request.provider, request.model), mode=request.mode)
        qa.restore_history([item.model_dump() for item in request.history])
        return SocraticRun(qa, request)

    def open_session(self, request: SocraticQARequest, run: SocraticRun):
        settings = {"provider": request.provider, "model": request.model, "mode": request.mode}
        if request.session_id is not None:
            return self.repository.resume(request.session_id, self.session_type, settings)
        return self.repository.start(self.session_type, request.question[:100], settings)

    def on_open(self, session, run: SocraticRun) -> None:
        self.repository.add_message(session, "user", run.request.question)

    def session_event(self, session, run: SocraticRun) -> dict:
        return {"type": "session", "session_id": session.id, "mode": run.request.mode}

    def events(self, run: SocraticRun):
        return run.qa.stream_ask(run.request.question)

    def finish(self, session, run: SocraticRun, event: dict) -> None:
        answer = event.get("content") or ""
        messages = [("assistant", answer, {"mode": run.request.mode})] if answer else []
        self.repository.complete(session, messages=messages)
