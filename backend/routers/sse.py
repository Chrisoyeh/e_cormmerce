import datetime
import asyncio
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/events", tags=["Server-Sent Events"])

# Shared subscriber list — populated by store.py and students.py broadcasters
from backend.routers.store import get_sse_subscribers

@router.get("")
async def sse_stream(request: Request):
    """
    Server-Sent Events endpoint for real-time dashboard updates.
    Clients subscribe here and receive push events when orders or pupils change.
    Heartbeat every 20s keeps the connection alive on Render.
    """
    import queue as queue_module

    q: queue_module.Queue = queue_module.Queue()
    subscribers = get_sse_subscribers()
    subscribers.append(q)

    async def event_generator():
        try:
            # Send initial connection confirmation
            yield "data: {\"type\":\"connected\"}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                # Check for queued events (non-blocking)
                try:
                    event_type = q.get_nowait()
                    payload = json.dumps({"type": event_type, "timestamp": datetime.datetime.utcnow().isoformat() + "Z"})
                    yield f"data: {payload}\n\n"
                except Exception:
                    # No event — send heartbeat ping
                    yield ": ping\n\n"
                    await asyncio.sleep(20)
        finally:
            try:
                subscribers.remove(q)
            except ValueError:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )
