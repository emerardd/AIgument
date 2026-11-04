"""HTTP helpers shared by routers that expose a SessionRunService as SSE."""
from contextlib import aclosing
from typing import Any, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from services.session_run import SessionRunService
from utils import sse_event, sse_response

ModelT = TypeVar("ModelT", bound=BaseModel)


def validate_request(schema: type[ModelT], /, **params: Any) -> ModelT:
    """Validate query parameters with the same model the service uses (422 on failure)."""
    try:
        return schema(**params)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def stream_run(service: SessionRunService, request: BaseModel):
    """Encode a run as SSE; any failure becomes a final ``error`` event."""
    async def generate():
        try:
            async with aclosing(service.run(request)) as events:
                async for event in events:
                    yield sse_event(event)
        except Exception as exc:
            yield sse_event({"type": "error", "error": str(exc)})

    return sse_response(generate())
