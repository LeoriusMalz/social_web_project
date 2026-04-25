import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket


class MessageWebSocketHub:
    def __init__(self):
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._connections[user_id].add(websocket)

    async def disconnect(self, user_id: int, websocket: WebSocket):
        async with self._lock:
            user_connections = self._connections.get(user_id)
            if not user_connections:
                return
            user_connections.discard(websocket)
            if not user_connections:
                self._connections.pop(user_id, None)

    async def broadcast_to_users(self, user_ids: list[int], payload: dict):
        data = json.dumps(payload, default=str)
        async with self._lock:
            targets = []
            for user_id in set(user_ids):
                targets.extend(self._connections.get(user_id, set()))

        stale = []
        for socket in targets:
            try:
                await socket.send_text(data)
            except Exception:
                stale.append(socket)

        if stale:
            async with self._lock:
                for user_id, user_connections in list(self._connections.items()):
                    for socket in stale:
                        user_connections.discard(socket)
                    if not user_connections:
                        self._connections.pop(user_id, None)


messages_hub = MessageWebSocketHub()
