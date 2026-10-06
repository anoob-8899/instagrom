import asyncio
import json
import time
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from instagrom.database import get_db
from instagrom.models import User
from instagrom.auth import get_current_user_required
from instagrom.realtime import realtime_hub
from instagrom.presence import record_presence_heartbeat

router = APIRouter(prefix="/api/realtime", tags=["realtime"])

@router.get("/stream")
async def realtime_event_stream(
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    # Record heartbeat
    record_presence_heartbeat(db, current_user.id)

    queue = realtime_hub.subscribe(current_user.id)

    async def event_generator():
        try:
            # 1. Initial Handshake
            init_event = {
                "type": "CONNECTED",
                "payload": {
                    "userId": current_user.id,
                    "serverTime": int(time.time() * 1000),
                },
            }
            yield f"data: {json.dumps(init_event)}\n\n"

            # 2. Main event loop with 25s ping
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                try:
                    # Wait up to 25 seconds for an event from the queue
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keep-alive PING
                    ping_event = {
                        "type": "PING",
                        "timestamp": int(time.time() * 1000),
                    }
                    yield f"data: {json.dumps(ping_event)}\n\n"
        finally:
            realtime_hub.unsubscribe(current_user.id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
