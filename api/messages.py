import json

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse

from auth import SESSION_COOKIE_NAME, require_authenticated_user
from db import get_db
from services.messages import (
    add_chat_members,
    can_restore_kicked_member,
    create_group_chat,
    get_chat_avatar as get_chat_avatar_blob,
    create_message,
    create_system_message,
    delete_message,
    ensure_chat_access,
    get_chat_info,
    get_chat_participant_ids,
    get_user_short_name,
    get_first_unread_message_id,
    get_latest_participation,
    get_messages_batch,
    get_or_create_dialog_chat,
    leave_chat,
    list_addable_friends,
    list_chat_participants,
    list_dialogs,
    mark_read_upto,
    remove_chat_member,
    restore_member,
    search_dialog_candidates,
    set_member_role,
    update_chat_avatar,
    update_chat_title,
    update_message,
)
from services.messages_ws import messages_hub
from services.sessions import get_session_by_token

ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

router = APIRouter()


class CreateMessagePayload(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    reply_msg_id: int | None = None


class UpdateMessagePayload(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class ReadPayload(BaseModel):
    upto_msg_id: int


class CreateGroupPayload(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    member_ids: list[int] = Field(default_factory=list, max_length=200)


class ChatMembersPayload(BaseModel):
    user_ids: list[int] = Field(default_factory=list, max_length=200)


class ChatRolePayload(BaseModel):
    role_id: int = Field(ge=0, le=2)


class ChatTitlePayload(BaseModel):
    title: str = Field(min_length=1, max_length=120)

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




@router.get("/dialogs/{chat_id}/avatar")
async def get_chat_avatar(chat_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к беседе")

    avatar = await get_chat_avatar_blob(db, chat_id)
    if not avatar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аватар не найден")

    return StreamingResponse(iter([avatar]), media_type="image/*")

@router.get("/dialogs/{chat_id}")
async def get_dialog(chat_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к диалогу")

    chat_info = await get_chat_info(db, chat_id, current_user["user_id"])
    if not chat_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Чат не найден")

    first_unread_msg_id = await get_first_unread_message_id(db, chat_id, current_user["user_id"])
    payload = {
        "chat_id": chat_id,
        "type_id": chat_info["type_id"],
        "title": chat_info["title"],
        "has_avatar": chat_info["has_avatar"],
        "role_id": chat_info["role_id"],
        "left_at": chat_info["left_at"],
        "kicked_by": chat_info["kicked_by"],
        "participant_count": chat_info["participant_count"],
        "first_unread_msg_id": first_unread_msg_id,
    }
    if chat_info["peer_id"]:
        payload["peer"] = {
            "id": chat_info["peer_id"],
            "name": chat_info["peer_name"],
            "surname": chat_info["peer_surname"],
            "has_avatar": chat_info["peer_has_avatar"],
        }
    return payload


@router.get("/dialogs/{chat_id}/participants")
async def get_chat_participants(chat_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к беседе")

    return await list_chat_participants(db, chat_id)


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






@router.post("/dialogs/group", status_code=status.HTTP_201_CREATED)
async def create_group_dialog(
    payload: CreateGroupPayload,
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    member_ids = [int(mid) for mid in payload.member_ids if mid > 0]
    chat_id = await create_group_chat(db, current_user["user_id"], payload.title, member_ids)
    if not chat_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректные данные беседы")

    await create_system_message(db, chat_id, current_user["user_id"], "Беседа создана")
    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids, {"type": "chat:new", "chat_id": chat_id})
    return {"chat_id": chat_id}


@router.post("/dialogs/{chat_id}/avatar")
async def upload_chat_avatar(
    chat_id: int,
    file: UploadFile = File(...),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к беседе")

    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимый формат изображения")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пуст")

    await update_chat_avatar(db, chat_id, content)
    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids, {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True}


@router.delete("/dialogs/{chat_id}/avatar")
async def delete_chat_avatar(chat_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к беседе")

    await update_chat_avatar(db, chat_id, None)
    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids, {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True}


@router.patch("/dialogs/{chat_id}/title")
async def patch_chat_title(chat_id: int, payload: ChatTitlePayload, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    me = await get_latest_participation(db, chat_id, current_user["user_id"])
    if not me or me["left_at"] is not None or me["role_id"] != 2:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только владелец может менять название")
    ok = await update_chat_title(db, chat_id, payload.title)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название не обновлено")
    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids, {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True}


@router.post("/dialogs/{chat_id}/leave")
async def leave_group_chat(chat_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    me = await get_latest_participation(db, chat_id, current_user["user_id"])
    if not me or me["left_at"] is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось покинуть беседу")

    full_name = await get_user_short_name(db, current_user["user_id"])
    await create_system_message(db, chat_id, current_user["user_id"], f"{full_name['surname']} {full_name['name']} покинул(а) беседу")
    ok = await leave_chat(db, chat_id, current_user["user_id"])
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось покинуть беседу")
    user_ids = await get_chat_participant_ids(db, chat_id)
    user_ids.append(current_user["user_id"])
    await messages_hub.broadcast_to_users(list(set(user_ids)), {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True}


@router.post("/dialogs/{chat_id}/participants/add")
async def add_members_to_chat(chat_id: int, payload: ChatMembersPayload, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    added = await add_chat_members(db, chat_id, current_user["user_id"], payload.user_ids)
    if not added:
        return {"ok": True, "added": []}
    actor = await get_user_short_name(db, current_user["user_id"])
    for user_id in added:
        target = await get_user_short_name(db, user_id)
        await create_system_message(
            db,
            chat_id,
            current_user["user_id"],
            f"{actor['surname']} {actor['name']} добавил(а) {target['surname']} {target['name']} в беседу",
        )
    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids, {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True, "added": added}


@router.get("/dialogs/{chat_id}/addable-friends")
async def get_addable_friends(
    chat_id: int,
    q: str = Query(default="", max_length=100),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к беседе")
    return await list_addable_friends(db, chat_id, current_user["user_id"], q)


@router.post("/dialogs/{chat_id}/participants/{user_id}/remove")
async def remove_member_from_chat(chat_id: int, user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    actor_part = await get_latest_participation(db, chat_id, current_user["user_id"])
    target_part = await get_latest_participation(db, chat_id, user_id)
    if not actor_part or not target_part or actor_part["left_at"] is not None or target_part["left_at"] is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    if actor_part["role_id"] not in (1, 2):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    if target_part["role_id"] == 2 and actor_part["role_id"] != 2:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    actor = await get_user_short_name(db, current_user["user_id"])
    target = await get_user_short_name(db, user_id)
    await create_system_message(
        db,
        chat_id,
        current_user["user_id"],
        f"Пользователя {target['surname']} {target['name']} кикнул(а) {actor['surname']} {actor['name']}",
    )
    ok = await remove_chat_member(db, chat_id, current_user["user_id"], user_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    user_ids = await get_chat_participant_ids(db, chat_id)
    user_ids.append(user_id)
    await messages_hub.broadcast_to_users(list(set(user_ids)), {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True}


@router.post("/dialogs/{chat_id}/participants/{user_id}/restore")
async def restore_member_to_chat(chat_id: int, user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    allowed = await can_restore_kicked_member(db, chat_id, current_user["user_id"], user_id)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нельзя вернуть этого участника")
    ok = await restore_member(db, chat_id, current_user["user_id"], user_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось вернуть участника")
    actor = await get_user_short_name(db, current_user["user_id"])
    target = await get_user_short_name(db, user_id)
    await create_system_message(
        db,
        chat_id,
        current_user["user_id"],
        f"{actor['surname']} {actor['name']} добавил(а) {target['surname']} {target['name']} в беседу",
    )
    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids + [user_id], {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True}


@router.patch("/dialogs/{chat_id}/participants/{user_id}/role")
async def change_member_role(chat_id: int, user_id: int, payload: ChatRolePayload, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    ok = await set_member_role(db, chat_id, current_user["user_id"], user_id, payload.role_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    user_ids = await get_chat_participant_ids(db, chat_id)
    await messages_hub.broadcast_to_users(user_ids, {"type": "chat:updated", "chat_id": chat_id})
    return {"ok": True}

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




@router.post("/dialogs/{chat_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message_to_chat(
    chat_id: int,
    payload: CreateMessagePayload,
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    has_access = await ensure_chat_access(db, chat_id, current_user["user_id"])
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к беседе")

    me = await get_latest_participation(db, chat_id, current_user["user_id"])
    if not me:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к беседе")
    if me["left_at"] is not None:
        if me["kicked_by"] != current_user["user_id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Вы исключены из беседы")
        restored = await restore_member(db, chat_id, current_user["user_id"], current_user["user_id"])
        if not restored:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось вернуться в беседу")
        full_name = await get_user_short_name(db, current_user["user_id"])
        await create_system_message(db, chat_id, current_user["user_id"], f"{full_name['surname']} {full_name['name']} вернулся(ась) в беседу")

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
