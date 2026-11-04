"""Dual-character conversation run: each finished message is committed immediately."""

from dataclasses import dataclass

from repositories.session_run import SessionRunRepository
from schemas.session_runs import DualChatRequest
from services.dual_chat import DualChatService, create_dual_chat
from services.session_run import SessionRunService


@dataclass
class DualChatRun:
    chat: DualChatService
    turns: int


class DualChatRunService(SessionRunService[DualChatRequest, SessionRunRepository]):
    label = "Dual chat run"

    async def prepare(self, request: DualChatRequest) -> DualChatRun:
        chat = create_dual_chat(
            ai_client=self.client(request.provider, request.model),
            topic=request.topic, role_a_template=request.role_a, role_b_template=request.role_b,
        )
        return DualChatRun(chat, request.turns)

    def open_session(self, request: DualChatRequest, run: DualChatRun):
        return self.repository.start("dual_chat", request.topic, {
            "provider": request.provider, "model": request.model,
            "role_a": request.role_a, "role_b": request.role_b,
            "turns": request.turns, "mode": "dual_character",
        })

    def events(self, run: DualChatRun):
        return run.chat.run_conversation(turns=run.turns)

    def persist(self, session, run: DualChatRun, event: dict) -> None:
        if event.get("type") == "message_complete":
            self.repository.add_message(
                session, event.get("speaker") or "unknown", event.get("content") or "",
                {"role_id": event.get("role_id"), "turn": event.get("turn"), "mode": "dual_character"},
            )
