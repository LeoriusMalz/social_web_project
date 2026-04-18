import hashlib
import secrets

from utils.sql_loader import load_sql

create_session_sql = load_sql("sessions/create_session.sql")
get_session_by_token_sql = load_sql("sessions/get_session_by_token.sql")
revoke_session_by_token_sql = load_sql("sessions/revoke_session_by_token.sql")

SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


async def create_session(conn, user_id: int, user_agent: str | None, ip_address: str | None):
    raw_token = generate_session_token()
    token_hash = _hash_token(raw_token)

    session_row = await conn.fetchrow(
        create_session_sql,
        user_id,
        token_hash,
        str(SESSION_TTL_SECONDS),
        user_agent,
        ip_address,
    )

    return {
        "session_id": session_row["session_id"],
        "token": raw_token,
        "expires_in": SESSION_TTL_SECONDS,
    }


async def get_session_by_token(conn, token: str):
    token_hash = _hash_token(token)
    row = await conn.fetchrow(get_session_by_token_sql, token_hash)
    return dict(row) if row else None


async def revoke_session_by_token(conn, token: str):
    token_hash = _hash_token(token)
    await conn.execute(revoke_session_by_token_sql, token_hash)
