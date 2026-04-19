from typing import Literal

from utils.sql_loader import load_sql

PENDING = 0
ACCEPTED = 1
CANCELLED = 2
REJECTED = 3

get_active_friendship_sql = load_sql("friends/get_active_friendship.sql")
get_pending_request_sql = load_sql("friends/get_pending_request.sql")
list_friends_sql = load_sql("friends/list_friends.sql")
list_incoming_requests_sql = load_sql("friends/list_incoming_requests.sql")
list_outgoing_requests_sql = load_sql("friends/list_outgoing_requests.sql")
search_users_with_relationship_sql = load_sql("friends/search_users_with_relationship.sql")
create_request_sql = load_sql("friends/create_request.sql")
update_outgoing_request_status_sql = load_sql("friends/update_outgoing_request_status.sql")
update_incoming_request_status_sql = load_sql("friends/update_incoming_request_status.sql")
upsert_friendship_sql = load_sql("friends/upsert_friendship.sql")
remove_friendship_sql = load_sql("friends/remove_friendship.sql")
list_user_friends_sql = load_sql("friends/list_user_friends.sql")
list_user_followers_sql = load_sql("friends/list_user_followers.sql")


async def get_relationship_status(conn, current_user_id: int, target_user_id: int) -> Literal["none", "friend", "outgoing", "incoming"]:
    if current_user_id == target_user_id:
        return "none"

    user1_id = min(current_user_id, target_user_id)
    user2_id = max(current_user_id, target_user_id)

    friendship = await conn.fetchrow(get_active_friendship_sql, user1_id, user2_id)
    if friendship:
        return "friend"

    outgoing = await conn.fetchrow(get_pending_request_sql, current_user_id, target_user_id, PENDING)
    if outgoing:
        return "outgoing"

    incoming = await conn.fetchrow(get_pending_request_sql, target_user_id, current_user_id, PENDING)
    if incoming:
        return "incoming"

    return "none"


async def list_friends(conn, current_user_id: int):
    rows = await conn.fetch(list_friends_sql, current_user_id)
    return [dict(row) for row in rows]


async def list_incoming_requests(conn, current_user_id: int):
    rows = await conn.fetch(list_incoming_requests_sql, current_user_id, PENDING)
    return [dict(row) for row in rows]


async def list_outgoing_requests(conn, current_user_id: int):
    rows = await conn.fetch(list_outgoing_requests_sql, current_user_id, PENDING)
    return [dict(row) for row in rows]


async def search_users_with_relationship(conn, current_user_id: int, query: str):
    rows = await conn.fetch(
        search_users_with_relationship_sql,
        current_user_id,
        f"%{query.strip().lower()}%",
        PENDING,
    )
    return [dict(row) for row in rows]


async def send_friend_request(conn, from_user_id: int, to_user_id: int):
    if from_user_id == to_user_id:
        return None

    relation = await get_relationship_status(conn, from_user_id, to_user_id)
    if relation in {"friend", "outgoing", "incoming"}:
        return {"relation": relation}

    row = await conn.fetchrow(create_request_sql, from_user_id, to_user_id, PENDING)
    return {"request_id": row["request_id"], "relation": "outgoing"}


async def cancel_outgoing_request(conn, from_user_id: int, to_user_id: int):
    row = await conn.fetchrow(
        update_outgoing_request_status_sql,
        from_user_id,
        to_user_id,
        CANCELLED,
        PENDING,
    )
    return dict(row) if row else None


async def reject_incoming_request(conn, current_user_id: int, from_user_id: int):
    row = await conn.fetchrow(
        update_incoming_request_status_sql,
        from_user_id,
        current_user_id,
        REJECTED,
        PENDING,
    )
    return dict(row) if row else None


async def accept_incoming_request(conn, current_user_id: int, from_user_id: int):
    request_row = await conn.fetchrow(
        update_incoming_request_status_sql,
        from_user_id,
        current_user_id,
        ACCEPTED,
        PENDING,
    )

    if not request_row:
        return None

    user1_id = min(from_user_id, current_user_id)
    user2_id = max(from_user_id, current_user_id)

    await conn.execute(upsert_friendship_sql, user1_id, user2_id, request_row["request_id"])

    return {"request_id": request_row["request_id"]}


async def remove_friend_and_create_reverse_request(conn, current_user_id: int, target_user_id: int):
    user1_id = min(current_user_id, target_user_id)
    user2_id = max(current_user_id, target_user_id)

    removed = await conn.fetchrow(remove_friendship_sql, user1_id, user2_id, current_user_id)

    if not removed:
        return None

    await conn.execute(create_request_sql, target_user_id, current_user_id, PENDING)

    return {"ok": True}


async def list_user_friends(conn, user_id: int):
    rows = await conn.fetch(list_user_friends_sql, user_id)
    return [dict(row) for row in rows]


async def list_user_followers(conn, user_id: int):
    rows = await conn.fetch(list_user_followers_sql, user_id, PENDING)
    return [dict(row) for row in rows]
