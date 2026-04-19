from services.users import hash_password
from utils.sql_loader import load_sql

get_settings_user_sql = load_sql("settings/get_settings_user.sql")
update_settings_user_sql = load_sql("settings/update_settings_user.sql")
list_marital_statuses_sql = load_sql("settings/list_marital_statuses.sql")
search_cities_sql = load_sql("settings/search_cities.sql")
check_nickname_taken_by_other_sql = load_sql("settings/check_nickname_taken_by_other.sql")
check_email_taken_by_other_sql = load_sql("settings/check_email_taken_by_other.sql")
check_phone_taken_by_other_sql = load_sql("settings/check_phone_taken_by_other.sql")
update_avatar_sql = load_sql("settings/update_avatar.sql")
get_user_avatar_sql = load_sql("settings/get_user_avatar.sql")
clear_avatar_sql = load_sql("settings/clear_avatar.sql")
get_password_hash_by_user_id_sql = load_sql("settings/get_password_hash_by_user_id.sql")
update_password_sql = load_sql("settings/update_password.sql")


async def get_settings_user(conn, user_id: int):
    row = await conn.fetchrow(get_settings_user_sql, user_id)
    return dict(row) if row else None


async def update_settings_user(conn, user_id: int, payload: dict):
    row = await conn.fetchrow(
        update_settings_user_sql,
        user_id,
        payload["name"],
        payload["surname"],
        payload["patronym"],
        payload["nickname"],
        payload["email"],
        payload["phone"],
        payload["sex"],
        payload["marital_status_id"],
        payload["city_id"],
    )
    return dict(row) if row else None


async def list_marital_statuses(conn):
    rows = await conn.fetch(list_marital_statuses_sql)
    return [dict(row) for row in rows]


async def search_cities(conn, query: str):
    rows = await conn.fetch(search_cities_sql, f"%{query.strip().lower()}%")
    return [dict(row) for row in rows]


async def is_nickname_taken_by_other(conn, nickname: str, user_id: int) -> bool:
    row = await conn.fetchrow(check_nickname_taken_by_other_sql, nickname, user_id)
    return bool(row["is_taken"])


async def is_email_taken_by_other(conn, email: str, user_id: int) -> bool:
    row = await conn.fetchrow(check_email_taken_by_other_sql, email, user_id)
    return bool(row["is_taken"])


async def is_phone_taken_by_other(conn, phone: str, user_id: int) -> bool:
    row = await conn.fetchrow(check_phone_taken_by_other_sql, phone, user_id)
    return bool(row["is_taken"])


async def update_avatar(conn, user_id: int, content: bytes):
    await conn.execute(update_avatar_sql, user_id, content)


async def get_user_avatar(conn, user_id: int):
    row = await conn.fetchrow(get_user_avatar_sql, user_id)
    if not row:
        return None
    return row["avatar"]


async def clear_avatar(conn, user_id: int):
    await conn.execute(clear_avatar_sql, user_id)


async def verify_old_password(conn, user_id: int, old_password: str) -> bool:
    row = await conn.fetchrow(get_password_hash_by_user_id_sql, user_id)
    if not row:
        return False
    return row["password_hash"] == hash_password(old_password)


async def change_password(conn, user_id: int, new_password: str):
    await conn.execute(update_password_sql, user_id, hash_password(new_password))
