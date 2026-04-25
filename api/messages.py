import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from auth import SESSION_COOKIE_NAME, require_authenticated_user
from db import get_db
from services.messages import (
    create_message,
    delete_message,
    ensure_chat_access,
    get_chat_participant_ids,
    get_dialog_peer,
    get_first_unread_message_id,
    get_messages_batch,
    get_or_create_dialog_chat,
    list_dialogs,
    mark_read_upto,
    search_dialog_candidates,
    update_message,
)
from services.messages_ws import messages_hub
from services.sessions import get_session_by_token

router = APIRouter()


class CreateMessagePayload(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    reply_msg_id: int | None = None


class UpdateMessagePayload(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class ReadPayload(BaseModel):
    upto_msg_id: int


def _extract_cookie_token_from_header(cookie_header: str | None):
    if not cookie_header:
        return None

    parts = [item.strip() for item in cookie_header.split(";")]
    for part in parts:
        if not part or "=" not in part:
            continue
        key, value = part.split("=", 1)
        if key == SESSION_COOKIE_NAME:
            return value
    return None


@router.get("/dialogs")
async def get_dialogs(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    return await list_dialogs(db, current_user["user_id"], limit, offset)


@router.get("/search")
async def search_dialog_users(
    q: str = Query(min_length=1, max_length=100),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    return await search_dialog_candidates(db, current_user["user_id"], q)


@router.get("/dialogs/{chat_id}")
async def get_dialog(chat_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к диалогу")

    peer = await get_dialog_peer(db, chat_id, current_user["user_id"])
    if not peer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Диалог не найден")

    first_unread_msg_id = await get_first_unread_message_id(db, chat_id, current_user["user_id"])
    return {
        "chat_id": chat_id,
        "peer": dict(peer),
        "first_unread_msg_id": first_unread_msg_id,
    }


@router.get("/dialogs/{chat_id}/messages")
async def get_dialog_messages(
    chat_id: int,
    limit: int = Query(default=20, ge=1, le=50),
    before_id: int | None = Query(default=None, ge=1),
    after_id: int | None = Query(default=None, ge=1),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    if before_id and after_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Выберите либо before_id, либо after_id")

    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к диалогу")

    messages = await get_messages_batch(db, chat_id, current_user["user_id"], limit, before_id, after_id)
    return {"items": messages}




@router.post("/dialogs/by-user/{target_user_id}")
async def open_dialog_with_user(
    target_user_id: int,
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    chat_id = await get_or_create_dialog_chat(db, current_user["user_id"], target_user_id)
    if not chat_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Диалог можно начать только с другом")

    return {"chat_id": chat_id}


@router.post("/dialogs/by-user/{target_user_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message_to_user(
    target_user_id: int,
    payload: CreateMessagePayload,
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    chat_id = await get_or_create_dialog_chat(db, current_user["user_id"], target_user_id)
    if not chat_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Диалог можно начать только с другом")

    msg_id = await create_message(db, chat_id, current_user["user_id"], payload.content, payload.reply_msg_id)
    if not msg_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пустое сообщение")

    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids, {"type": "message:new", "chat_id": chat_id, "msg_id": msg_id})
    return {"chat_id": chat_id, "msg_id": msg_id}


@router.patch("/messages/{msg_id}")
async def edit_message(msg_id: int, payload: UpdateMessagePayload, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    updated = await update_message(db, msg_id, current_user["user_id"], payload.content)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")

    user_ids = await get_chat_participant_ids(db, updated["chat_id"])
    await messages_hub.broadcast_to_users(
        user_ids,
        {"type": "message:updated", "chat_id": updated["chat_id"], "msg_id": updated["msg_id"]},
    )
    return {"ok": True}


@router.delete("/messages/{msg_id}")
async def remove_message(msg_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    deleted = await delete_message(db, msg_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")

    user_ids = await get_chat_participant_ids(db, deleted["chat_id"])
    await messages_hub.broadcast_to_users(
        user_ids,
        {"type": "message:deleted", "chat_id": deleted["chat_id"], "msg_id": deleted["msg_id"]},
    )
    return {"ok": True}


@router.post("/dialogs/{chat_id}/read")
async def mark_dialog_read(chat_id: int, payload: ReadPayload, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к диалогу")

    read_count = await mark_read_upto(db, chat_id, current_user["user_id"], payload.upto_msg_id)
    if read_count > 0:
        user_ids = await get_chat_participant_ids(db, chat_id)
        await messages_hub.broadcast_to_users(
            user_ids,
            {"type": "message:read", "chat_id": chat_id, "upto_msg_id": payload.upto_msg_id, "reader_id": current_user["user_id"]},
        )
    return {"ok": True, "read_count": read_count}


@router.websocket("/ws")
async def messages_ws(websocket: WebSocket):
    token = _extract_cookie_token_from_header(websocket.headers.get("cookie"))
    if not token:
        await websocket.close(code=1008)
        return

    pool = websocket.app.state.pool
    async with pool.acquire() as db:
        session = await get_session_by_token(db, token)

    if not session:
        await websocket.close(code=1008)
        return

    user_id = session["user_id"]
    await messages_hub.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue

            if payload.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        await messages_hub.disconnect(user_id, websocket)
