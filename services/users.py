from utils.sql_loader import load_sql

create_user_sql = load_sql("users/create_user.sql")
get_user_sql = load_sql("users/get_user.sql")

async def create_user(conn, username, email):
    row = await conn.fetchrow(create_user_sql, username, email)
    return dict(row)

async def get_user(conn, user_id):
    row = await conn.fetchrow(get_user_sql, user_id)
    return dict(row) if row else None
