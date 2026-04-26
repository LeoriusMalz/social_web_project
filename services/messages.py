from __future__ import annotations

from datetime import datetime

from utils.sql_loader import load_sql

DIALOG_CHAT_TYPE_ID = 0
GROUP_CHAT_TYPE_ID = 1
DEFAULT_ROLE_ID = 0
OWNER_ROLE_ID = 2

is_friend_sql = load_sql("messages/is_friend.sql")
get_existing_dialog_chat_sql = load_sql("messages/get_existing_dialog_chat.sql")
create_chat_sql = load_sql("messages/create_chat.sql")
create_group_chat_sql = load_sql("messages/create_group_chat.sql")
add_participation_sql = load_sql("messages/add_participation.sql")
get_dialog_peer_sql = load_sql("messages/get_dialog_peer.sql")
get_chat_info_sql = load_sql("messages/get_chat_info.sql")
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
create_system_message_sql = load_sql("messages/create_system_message.sql")
update_chat_title_sql = load_sql("messages/update_chat_title.sql")
update_chat_avatar_sql = load_sql("messages/update_chat_avatar.sql")
get_latest_participation_sql = load_sql("messages/get_latest_participation.sql")
leave_participation_sql = load_sql("messages/leave_participation.sql")
kick_participation_sql = load_sql("messages/kick_participation.sql")
set_participation_role_sql = load_sql("messages/set_participation_role.sql")
list_chat_participants_sql = load_sql("messages/list_chat_participants.sql")
get_user_short_name_sql = load_sql("messages/get_user_short_name.sql")
get_chat_avatar_sql = load_sql("messages/get_chat_avatar.sql")
list_friends_for_chat_add_sql = load_sql("messages/list_friends_for_chat_add.sql")
get_chat_owner_id_sql = load_sql("messages/get_chat_owner_id.sql")


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

    chat = await conn.fetchrow(
        create_chat_sql,
        DIALOG_CHAT_TYPE_ID,
        datetime.utcnow(),
        user_id,
    )
    chat_id = chat["chat_id"]

    await conn.executemany(
        add_participation_sql,
        [
            (user_id, chat_id, DEFAULT_ROLE_ID, user_id),
            (target_user_id, chat_id, DEFAULT_ROLE_ID, user_id),
        ],
    )

    return chat_id


async def get_dialog_peer(conn, chat_id: int, current_user_id: int):
    return await conn.fetchrow(get_dialog_peer_sql, chat_id, current_user_id)


async def create_group_chat(conn, user_id: int, title: str, member_ids: list[int]):
    cleaned = title.strip()
    if not cleaned:
        return None

    unique_members = sorted({mid for mid in member_ids if mid != user_id})
    now = datetime.utcnow()
    chat = await conn.fetchrow(create_group_chat_sql, GROUP_CHAT_TYPE_ID, now, user_id, cleaned)
    chat_id = chat["chat_id"]

    rows = [(user_id, chat_id, OWNER_ROLE_ID, user_id)]
    rows.extend((mid, chat_id, DEFAULT_ROLE_ID, user_id) for mid in unique_members)
    await conn.executemany(add_participation_sql, rows)
    return chat_id


async def get_chat_info(conn, chat_id: int, current_user_id: int):
    return await conn.fetchrow(get_chat_info_sql, chat_id, current_user_id)


async def update_chat_title(conn, chat_id: int, title: str):
    cleaned = title.strip()
    if not cleaned:
        return False
    result = await conn.execute(update_chat_title_sql, chat_id, cleaned)
    return result.endswith("1")


async def update_chat_avatar(conn, chat_id: int, avatar: bytes | None):
    await conn.execute(update_chat_avatar_sql, chat_id, avatar)


async def ensure_chat_access(conn, chat_id: int, current_user_id: int) -> bool:
    row = await conn.fetchrow(ensure_chat_access_sql, chat_id, current_user_id)
    return bool(row)


async def list_dialogs(conn, current_user_id: int, limit: int, offset: int):
    rows = await conn.fetch(list_dialogs_sql, current_user_id, limit, offset)
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


async def create_system_message(conn, chat_id: int, actor_id: int, content: str):
    row = await conn.fetchrow(create_system_message_sql, chat_id, actor_id, content.strip())
    return row["msg_id"] if row else None


async def get_latest_participation(conn, chat_id: int, user_id: int):
    return await conn.fetchrow(get_latest_participation_sql, chat_id, user_id)


async def is_chat_active_participant(conn, chat_id: int, user_id: int):
    row = await get_latest_participation(conn, chat_id, user_id)
    return bool(row and row["left_at"] is None)


async def leave_chat(conn, chat_id: int, user_id: int):
    row = await get_latest_participation(conn, chat_id, user_id)
    if not row or row["left_at"] is not None:
        return False

    await conn.execute(leave_participation_sql, row["part_id"], user_id, user_id)
    return True


async def add_chat_members(conn, chat_id: int, inviter_id: int, user_ids: list[int]):
    inviter = await get_latest_participation(conn, chat_id, inviter_id)
    if not inviter or inviter["left_at"] is not None or inviter["role_id"] not in (1, 2):
        return []

    added = []
    for user_id in sorted({u for u in user_ids if u != inviter_id}):
        latest = await get_latest_participation(conn, chat_id, user_id)
        if latest and latest["left_at"] is None:
            continue
        if latest and latest["kicked_by"] == user_id:
            # Самостоятельно вышедшего добавлять нельзя.
            continue
        role_id = latest["role_id"] if latest else DEFAULT_ROLE_ID
        await conn.execute(add_participation_sql, user_id, chat_id, role_id, inviter_id)
        added.append(user_id)
    return added


async def remove_chat_member(conn, chat_id: int, actor_id: int, user_id: int):
    actor = await get_latest_participation(conn, chat_id, actor_id)
    target = await get_latest_participation(conn, chat_id, user_id)
    if not actor or not target or actor["left_at"] is not None or target["left_at"] is not None:
        return False
    if actor["role_id"] not in (1, 2):
        return False
    if target["role_id"] == 2 and actor["role_id"] != 2:
        return False

    await conn.execute(kick_participation_sql, target["part_id"], actor_id)
    return True


async def set_member_role(conn, chat_id: int, actor_id: int, user_id: int, role_id: int):
    actor = await get_latest_participation(conn, chat_id, actor_id)
    target = await get_latest_participation(conn, chat_id, user_id)
    if not actor or not target or actor["left_at"] is not None or target["left_at"] is not None:
        return False
    if actor["role_id"] != OWNER_ROLE_ID:
        return False
    if user_id == actor_id:
        return False
    if role_id not in (DEFAULT_ROLE_ID, 1):
        return False
    if target["role_id"] == OWNER_ROLE_ID:
        return False
    await conn.execute(set_participation_role_sql, target["part_id"], role_id)
    return True


async def can_restore_kicked_member(conn, chat_id: int, actor_id: int, user_id: int):
    target = await get_latest_participation(conn, chat_id, user_id)
    if not target or target["left_at"] is None:
        return False

    if target["kicked_by"] == user_id:
        return actor_id == user_id

    actor = await get_latest_participation(conn, chat_id, actor_id)
    if not actor or actor["left_at"] is not None:
        return False
    if actor["role_id"] == OWNER_ROLE_ID:
        return True
    return target["kicked_by"] == actor_id


async def restore_member(conn, chat_id: int, actor_id: int, user_id: int):
    if not await can_restore_kicked_member(conn, chat_id, actor_id, user_id):
        return False
    latest = await get_latest_participation(conn, chat_id, user_id)
    if not latest:
        return False
    await conn.execute(add_participation_sql, user_id, chat_id, latest["role_id"], actor_id)
    return True


async def list_chat_participants(conn, chat_id: int):
    rows = await conn.fetch(list_chat_participants_sql, chat_id)
    return [dict(row) for row in rows]


async def get_user_short_name(conn, user_id: int):
    return await conn.fetchrow(get_user_short_name_sql, user_id)


async def get_chat_avatar(conn, chat_id: int):
    row = await conn.fetchrow(get_chat_avatar_sql, chat_id)
    return row["avatar"] if row else None


async def list_addable_friends(conn, chat_id: int, inviter_id: int, query: str):
    inviter = await get_latest_participation(conn, chat_id, inviter_id)
    if not inviter or inviter["left_at"] is not None or inviter["role_id"] not in (1, 2):
        return []

    chat_row = await conn.fetchrow(get_chat_owner_id_sql, chat_id)
    owner_id = chat_row["created_by"] if chat_row else None
    q = f"%{query.strip().lower()}%" if query.strip() else ""
    friends = await conn.fetch(list_friends_for_chat_add_sql, inviter_id, q)
    result = []
    for friend in friends:
        latest = await get_latest_participation(conn, chat_id, friend["id"])
        if latest and latest["left_at"] is None:
            continue
        if latest:
            kicker = latest["kicked_by"]
            if kicker == friend["id"]:
                continue
            if kicker == owner_id and inviter_id != owner_id:
                continue
            if kicker not in (None, owner_id) and inviter_id not in (owner_id, kicker):
                continue
        result.append(dict(friend))
    return result


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
