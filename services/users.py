import hashlib

from utils.sql_loader import load_sql

create_user_sql = load_sql("users/create_user.sql")
get_user_sql = load_sql("users/get_user.sql")
check_user_exists_sql = load_sql("users/check_user_exists.sql")
get_user_for_login_sql = load_sql("users/get_user_for_login.sql")
get_user_by_nickname_sql = load_sql("users/get_user_by_nickname.sql")


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


async def create_user(conn, nickname, email):
    row = await conn.fetchrow(create_user_sql, "-", "-", None, nickname, email, None, "")
    return dict(row)


async def register_user(conn, nickname, email, name, surname, patronym, sex, password):
    password_hash = hash_password(password)
    row = await conn.fetchrow(
        create_user_sql,
        name,
        surname,
        patronym,
        nickname,
        email,
        sex,
        password_hash,
    )
    return dict(row)


async def check_user_exists(conn, nickname, email):
    row = await conn.fetchrow(check_user_exists_sql, nickname, email)
    return dict(row)


async def verify_user_credentials(conn, login, password):
    row = await conn.fetchrow(get_user_for_login_sql, login)

    if not row:
        return None

    user = dict(row)
    if user["password_hash"] != hash_password(password):
        return None

    return {
        "id": user["id"],
        "nickname": user["nickname"],
        "email": user["email"],
    }


async def get_user(conn, user_id):
    row = await conn.fetchrow(get_user_sql, user_id)
    return dict(row) if row else None


async def get_user_by_nickname(conn, nickname):
    row = await conn.fetchrow(get_user_by_nickname_sql, nickname)
    return dict(row) if row else None
