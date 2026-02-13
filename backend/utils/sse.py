"""SSE helpers for consistent event serialization and response headers."""

import json
from typing import Any, AsyncIterator, Iterator

from fastapi.responses import StreamingResponse

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def sse_event(payload: dict[str, Any], ensure_ascii: bool = False) -> str:
    """Serialize an SSE event payload to wire format."""
    return f"data: {json.dumps(payload, ensure_ascii=ensure_ascii)}\n\n"


def sse_response(generator: Iterator[str] | AsyncIterator[str]) -> StreamingResponse:
    """Create a StreamingResponse with unified SSE headers."""
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
