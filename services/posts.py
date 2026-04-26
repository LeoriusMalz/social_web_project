from utils.sql_loader import load_sql

create_post_sql = load_sql("posts/create_post.sql")
list_posts_sql = load_sql("posts/list_posts.sql")
get_post_by_id_sql = load_sql("posts/get_post_by_id.sql")
get_post_file_sql = load_sql("posts/get_post_file.sql")
get_post_owner_sql = load_sql("posts/get_post_owner.sql")
upsert_reaction_sql = load_sql("posts/upsert_reaction.sql")
delete_reaction_sql = load_sql("posts/delete_reaction.sql")


async def create_post(conn, post_by: int, text_content: str | None, file_content: bytes | None):
    cleaned = (text_content or "").strip()
    payload_text = cleaned or None

    if payload_text is None and file_content is None:
        return None

    row = await conn.fetchrow(create_post_sql, post_by, payload_text, file_content)
    return row["post_id"] if row else None


async def list_user_posts(conn, profile_user_id: int, current_user_id: int, limit: int, before_post_id: int | None):
    rows = await conn.fetch(list_posts_sql, profile_user_id, current_user_id, limit, before_post_id)
    return [dict(row) for row in rows]


async def get_post_by_id(conn, post_id: int, current_user_id: int):
    row = await conn.fetchrow(get_post_by_id_sql, post_id, current_user_id)
    return dict(row) if row else None


async def get_post_file(conn, post_id: int):
    row = await conn.fetchrow(get_post_file_sql, post_id)
    return row["file_content"] if row else None


async def get_post_owner(conn, post_id: int):
    row = await conn.fetchrow(get_post_owner_sql, post_id)
    return row["post_by"] if row else None


async def set_post_reaction(conn, post_id: int, user_id: int, is_liked: bool):
    await conn.execute(upsert_reaction_sql, post_id, user_id, is_liked)


async def unset_post_reaction(conn, post_id: int, user_id: int):
    await conn.execute(delete_reaction_sql, post_id, user_id)
