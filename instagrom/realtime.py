import asyncio
import time
import logging
from typing import Dict, Set, Any

logger = logging.getLogger(__name__)

class RealtimeHub:
    def __init__(self):
        # Map: userId -> Set of asyncio.Queue
        self._listeners: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, user_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        if user_id not in self._listeners:
            self._listeners[user_id] = set()
        self._listeners[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: str, queue: asyncio.Queue):
        if user_id in self._listeners:
            self._listeners[user_id].discard(queue)
            if not self._listeners[user_id]:
                del self._listeners[user_id]

    def emit_to_user(self, user_id: str, event_type: str, payload: Any):
        if user_id in self._listeners:
            event = {
                "type": event_type,
                "payload": payload,
                "timestamp": int(time.time() * 1000),
            }
            for queue in list(self._listeners[user_id]):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(f"Queue full for user {user_id}, dropping event {event_type}")

    def broadcast(self, event_type: str, payload: Any):
        event = {
            "type": event_type,
            "payload": payload,
            "timestamp": int(time.time() * 1000),
        }
        for user_id, queues in list(self._listeners.items()):
            for queue in list(queues):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(f"Queue full for user {user_id}, dropping broadcast {event_type}")

    def is_user_connected(self, user_id: str) -> bool:
        return user_id in self._listeners and len(self._listeners[user_id]) > 0

realtime_hub = RealtimeHub()
