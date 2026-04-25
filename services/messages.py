from __future__ import annotations

from datetime import datetime

from utils.sql_loader import load_sql

DIALOG_CHAT_TYPE_ID = 0
DEFAULT_ROLE_ID = 0

is_friend_sql = load_sql("messages/is_friend.sql")
get_existing_dialog_chat_sql = load_sql("messages/get_existing_dialog_chat.sql")
create_chat_sql = load_sql("messages/create_chat.sql")
add_participation_sql = load_sql("messages/add_participation.sql")
get_dialog_peer_sql = load_sql("messages/get_dialog_peer.sql")
ensure_chat_access_sql = load_sql("messages/ensure_chat_access.sql")
list_dialogs_sql = load_sql("messages/list_dialogs.sql")
search_dialog_candidates_sql = load_sql("messages/search_dialog_candidates.sql")
get_reply_message_sql = load_sql("messages/get_reply_message.sql")
create_message_sql = load_sql("messages/create_message.sql")
update_message_sql = load_sql("messages/update_message.sql")
delete_message_sql = load_sql("messages/delete_message.sql")
get_chat_participant_ids_sql = load_sql("messages/get_chat_participant_ids.sql")
get_messages_batch_template_sql = load_sql("messages/get_messages_batch_template.sql")
get_first_unread_message_id_sql = load_sql("messages/get_first_unread_message_id.sql")
mark_read_upto_sql = load_sql("messages/mark_read_upto.sql")


async def is_friend(conn, user_id: int, target_user_id: int) -> bool:
    if user_id == target_user_id:
        return False
    u1, u2 = sorted((user_id, target_user_id))
    row = await conn.fetchrow(is_friend_sql, u1, u2)
    return bool(row)


async def get_or_create_dialog_chat(conn, user_id: int, target_user_id: int) -> int | None:
    if not await is_friend(conn, user_id, target_user_id):
        return None

    row = await conn.fetchrow(
        get_existing_dialog_chat_sql,
        user_id,
        target_user_id,
        DIALOG_CHAT_TYPE_ID,
    )

    if row:
        return row["chat_id"]

    now = datetime.utcnow()
    chat = await conn.fetchrow(
        create_chat_sql,
        DIALOG_CHAT_TYPE_ID,
        now,
        user_id,
    )
    chat_id = chat["chat_id"]

    await conn.executemany(
        add_participation_sql,
        [
            (user_id, chat_id, DEFAULT_ROLE_ID, now, user_id),
            (target_user_id, chat_id, DEFAULT_ROLE_ID, now, user_id),
        ],
    )

    return chat_id


async def get_dialog_peer(conn, chat_id: int, current_user_id: int):
    return await conn.fetchrow(get_dialog_peer_sql, chat_id, current_user_id)


async def ensure_chat_access(conn, chat_id: int, current_user_id: int) -> bool:
    row = await conn.fetchrow(ensure_chat_access_sql, chat_id, current_user_id)
    return bool(row)


async def list_dialogs(conn, current_user_id: int, limit: int, offset: int):
    rows = await conn.fetch(
        list_dialogs_sql,
        current_user_id,
        DIALOG_CHAT_TYPE_ID,
        limit,
        offset,
    )

    return [dict(row) for row in rows]


async def search_dialog_candidates(conn, current_user_id: int, query: str):
    q = f"%{query.strip().lower()}%"

    rows = await conn.fetch(
        search_dialog_candidates_sql,
        current_user_id,
        DIALOG_CHAT_TYPE_ID,
        q,
    )

    return [dict(row) for row in rows]


async def create_message(conn, chat_id: int, sender_id: int, content: str, reply_msg_id: int | None = None):
    cleaned = content.strip()
    if not cleaned:
        return None

    if reply_msg_id:
        reply_row = await conn.fetchrow(get_reply_message_sql, reply_msg_id, chat_id)
        if not reply_row:
            reply_msg_id = None

    row = await conn.fetchrow(
        create_message_sql,
        chat_id,
        sender_id,
        cleaned,
        reply_msg_id,
    )
    return row["msg_id"]


async def update_message(conn, msg_id: int, user_id: int, content: str):
    cleaned = content.strip()
    if not cleaned:
        return None

    row = await conn.fetchrow(update_message_sql, cleaned, msg_id, user_id)
    return dict(row) if row else None


async def delete_message(conn, msg_id: int, user_id: int):
    row = await conn.fetchrow(delete_message_sql, msg_id, user_id)
    return dict(row) if row else None


async def get_chat_participant_ids(conn, chat_id: int):
    rows = await conn.fetch(get_chat_participant_ids_sql, chat_id)
    return [row["user_id"] for row in rows]


async def get_messages_batch(conn, chat_id: int, current_user_id: int, limit: int, before_id: int | None, after_id: int | None):
    if before_id:
        where_extra = "AND m.msg_id < $4"
        params = (chat_id, current_user_id, limit, before_id)
        order = "m.msg_id DESC"
    elif after_id:
        where_extra = "AND m.msg_id > $4"
        params = (chat_id, current_user_id, limit, after_id)
        order = "m.msg_id ASC"
    else:
        where_extra = ""
        params = (chat_id, current_user_id, limit)
        order = "m.msg_id DESC"

    query = get_messages_batch_template_sql.format(where_extra=where_extra, order=order)
    rows = await conn.fetch(query, *params)

    return [dict(row) for row in rows]


async def get_first_unread_message_id(conn, chat_id: int, current_user_id: int):
    row = await conn.fetchrow(get_first_unread_message_id_sql, chat_id, current_user_id)
    return row["first_unread_msg_id"] if row else None


async def mark_read_upto(conn, chat_id: int, current_user_id: int, upto_msg_id: int):
    if not upto_msg_id:
        return 0

    rows = await conn.fetch(mark_read_upto_sql, chat_id, current_user_id, upto_msg_id)
    return len(rows)
