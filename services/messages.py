from __future__ import annotations

from datetime import datetime

DIALOG_CHAT_TYPE_ID = 0
DEFAULT_ROLE_ID = 0


async def is_friend(conn, user_id: int, target_user_id: int) -> bool:
    if user_id == target_user_id:
        return False
    u1, u2 = sorted((user_id, target_user_id))
    row = await conn.fetchrow(
        """
        SELECT 1
        FROM friendships
        WHERE user1_id = $1
          AND user2_id = $2
          AND deleted_at IS NULL
        """,
        u1,
        u2,
    )
    return bool(row)


async def get_or_create_dialog_chat(conn, user_id: int, target_user_id: int) -> int | None:
    if not await is_friend(conn, user_id, target_user_id):
        return None

    row = await conn.fetchrow(
        """
        SELECT p1.chat_id
        FROM participation p1
        JOIN participation p2 ON p2.chat_id = p1.chat_id
        JOIN chats c ON c.chat_id = p1.chat_id
        WHERE p1.user_id = $1
          AND p2.user_id = $2
          AND p1.left_at IS NULL
          AND p2.left_at IS NULL
          AND c.type_id = $3
        ORDER BY p1.chat_id DESC
        LIMIT 1
        """,
        user_id,
        target_user_id,
        DIALOG_CHAT_TYPE_ID,
    )

    if row:
        return row["chat_id"]

    now = datetime.utcnow()
    chat = await conn.fetchrow(
        """
        INSERT INTO chats (type_id, created_at, created_by)
        VALUES ($1, $2, $3)
        RETURNING chat_id
        """,
        DIALOG_CHAT_TYPE_ID,
        now,
        user_id,
    )
    chat_id = chat["chat_id"]

    await conn.executemany(
        """
        INSERT INTO participation (user_id, chat_id, role_id, joined_at, invited_by)
        VALUES ($1, $2, $3, $4, $5)
        """,
        [
            (user_id, chat_id, DEFAULT_ROLE_ID, now, user_id),
            (target_user_id, chat_id, DEFAULT_ROLE_ID, now, user_id),
        ],
    )

    return chat_id


async def get_dialog_peer(conn, chat_id: int, current_user_id: int):
    return await conn.fetchrow(
        """
        SELECT
            u.id,
            u.name,
            u.surname,
            (u.avatar IS NOT NULL) AS has_avatar
        FROM participation p_current
        JOIN participation p_peer ON p_peer.chat_id = p_current.chat_id
            AND p_peer.user_id <> p_current.user_id
            AND p_peer.left_at IS NULL
        JOIN users u ON u.id = p_peer.user_id
        WHERE p_current.chat_id = $1
          AND p_current.user_id = $2
          AND p_current.left_at IS NULL
        """,
        chat_id,
        current_user_id,
    )


async def ensure_chat_access(conn, chat_id: int, current_user_id: int) -> bool:
    row = await conn.fetchrow(
        """
        SELECT 1
        FROM participation
        WHERE chat_id = $1
          AND user_id = $2
          AND left_at IS NULL
        """,
        chat_id,
        current_user_id,
    )
    return bool(row)


async def list_dialogs(conn, current_user_id: int, limit: int, offset: int):
    rows = await conn.fetch(
        """
        WITH user_chats AS (
            SELECT p.chat_id
            FROM participation p
            JOIN chats c ON c.chat_id = p.chat_id
            WHERE p.user_id = $1
              AND p.left_at IS NULL
              AND c.type_id = $2
        ),
        latest AS (
            SELECT DISTINCT ON (m.chat_id)
                m.chat_id,
                m.msg_id,
                m.sender_id,
                m.content,
                m.sent_at,
                m.updated_at
            FROM messages m
            JOIN user_chats uc ON uc.chat_id = m.chat_id
            WHERE m.deleted_at IS NULL
            ORDER BY m.chat_id, m.msg_id DESC
        ),
        unread AS (
            SELECT m.chat_id,
                   COUNT(*)::INT AS unread_count,
                   MIN(m.msg_id)::INT AS first_unread_msg_id
            FROM messages m
            JOIN user_chats uc ON uc.chat_id = m.chat_id
            LEFT JOIN message_reads mr
                ON mr.msg_id = m.msg_id
               AND mr.user_id = $1
            WHERE m.deleted_at IS NULL
              AND m.sender_id <> $1
              AND mr.msg_id IS NULL
            GROUP BY m.chat_id
        ),
        peer AS (
            SELECT
                p1.chat_id,
                u.id AS peer_id,
                u.name,
                u.surname,
                (u.avatar IS NOT NULL) AS has_avatar
            FROM participation p1
            JOIN participation p2 ON p2.chat_id = p1.chat_id
                AND p2.user_id <> p1.user_id
                AND p2.left_at IS NULL
            JOIN users u ON u.id = p2.user_id
            WHERE p1.user_id = $1
              AND p1.left_at IS NULL
        )
        SELECT
            l.chat_id,
            l.msg_id AS last_msg_id,
            l.sender_id AS last_sender_id,
            l.content AS last_message,
            l.sent_at AS last_message_sent_at,
            l.updated_at AS last_message_updated_at,
            p.peer_id,
            p.name AS peer_name,
            p.surname AS peer_surname,
            p.has_avatar AS peer_has_avatar,
            COALESCE(unread.unread_count, 0) AS unread_count,
            unread.first_unread_msg_id,
            EXISTS (
                SELECT 1
                FROM message_reads r
                WHERE r.msg_id = l.msg_id
                  AND r.user_id <> $1
            ) AS last_my_message_seen_by_anyone
        FROM latest l
        JOIN peer p ON p.chat_id = l.chat_id
        LEFT JOIN unread ON unread.chat_id = l.chat_id
        ORDER BY l.msg_id DESC
        LIMIT $3 OFFSET $4
        """,
        current_user_id,
        DIALOG_CHAT_TYPE_ID,
        limit,
        offset,
    )

    return [dict(row) for row in rows]


async def search_dialog_candidates(conn, current_user_id: int, query: str):
    q = f"%{query.strip().lower()}%"

    rows = await conn.fetch(
        """
        WITH friends AS (
            SELECT
                CASE
                    WHEN f.user1_id = $1 THEN f.user2_id
                    ELSE f.user1_id
                END AS user_id
            FROM friendships f
            WHERE (f.user1_id = $1 OR f.user2_id = $1)
              AND f.deleted_at IS NULL
        ),
        dialog_peers AS (
            SELECT DISTINCT
                p_other.user_id
            FROM participation p_me
            JOIN chats c ON c.chat_id = p_me.chat_id AND c.type_id = $2
            JOIN participation p_other ON p_other.chat_id = p_me.chat_id
                AND p_other.user_id <> p_me.user_id
                AND p_other.left_at IS NULL
            WHERE p_me.user_id = $1
              AND p_me.left_at IS NULL
        )
        SELECT
            u.id,
            u.name,
            u.surname,
            (u.avatar IS NOT NULL) AS has_avatar,
            CASE WHEN dp.user_id IS NULL THEN false ELSE true END AS has_dialog
        FROM friends f
        JOIN users u ON u.id = f.user_id
        LEFT JOIN dialog_peers dp ON dp.user_id = u.id
        WHERE LOWER(COALESCE(u.surname, '') || ' ' || COALESCE(u.name, '')) LIKE $3
        ORDER BY has_dialog DESC, u.surname, u.name
        """,
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
        reply_row = await conn.fetchrow(
            """
            SELECT msg_id
            FROM messages
            WHERE msg_id = $1
              AND chat_id = $2
              AND deleted_at IS NULL
            """,
            reply_msg_id,
            chat_id,
        )
        if not reply_row:
            reply_msg_id = None

    row = await conn.fetchrow(
        """
        INSERT INTO messages (chat_id, sender_id, content, reply_msg_id, sent_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING msg_id
        """,
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

    row = await conn.fetchrow(
        """
        UPDATE messages
        SET content = $1,
            updated_at = NOW()
        WHERE msg_id = $2
          AND sender_id = $3
          AND deleted_at IS NULL
        RETURNING msg_id, chat_id
        """,
        cleaned,
        msg_id,
        user_id,
    )
    return dict(row) if row else None


async def delete_message(conn, msg_id: int, user_id: int):
    row = await conn.fetchrow(
        """
        UPDATE messages
        SET deleted_at = NOW(),
            deleted_by = $2
        WHERE msg_id = $1
          AND sender_id = $2
          AND deleted_at IS NULL
        RETURNING msg_id, chat_id
        """,
        msg_id,
        user_id,
    )
    return dict(row) if row else None


async def get_chat_participant_ids(conn, chat_id: int):
    rows = await conn.fetch(
        """
        SELECT user_id
        FROM participation
        WHERE chat_id = $1
          AND left_at IS NULL
        """,
        chat_id,
    )
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

    rows = await conn.fetch(
        f"""
        WITH base AS (
            SELECT
                m.msg_id,
                m.chat_id,
                m.sender_id,
                m.content,
                m.reply_msg_id,
                m.sent_at,
                m.updated_at,
                u.name AS sender_name,
                u.surname AS sender_surname,
                (u.avatar IS NOT NULL) AS sender_has_avatar,
                EXISTS (
                    SELECT 1
                    FROM message_reads mr
                    WHERE mr.msg_id = m.msg_id
                      AND mr.user_id <> $2
                ) AS read_by_anyone,
                EXISTS (
                    SELECT 1
                    FROM message_reads mr_self
                    WHERE mr_self.msg_id = m.msg_id
                      AND mr_self.user_id = $2
                ) AS read_by_me
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.chat_id = $1
              AND m.deleted_at IS NULL
              {where_extra}
            ORDER BY {order}
            LIMIT $3
        )
        SELECT
            b.*,
            r.sender_id AS reply_sender_id,
            ru.name AS reply_sender_name,
            ru.surname AS reply_sender_surname,
            r.content AS reply_content
        FROM base b
        LEFT JOIN messages r ON r.msg_id = b.reply_msg_id
        LEFT JOIN users ru ON ru.id = r.sender_id
        ORDER BY b.msg_id ASC
        """,
        *params,
    )

    return [dict(row) for row in rows]


async def get_first_unread_message_id(conn, chat_id: int, current_user_id: int):
    row = await conn.fetchrow(
        """
        SELECT MIN(m.msg_id) AS first_unread_msg_id
        FROM messages m
        LEFT JOIN message_reads mr
            ON mr.msg_id = m.msg_id
           AND mr.user_id = $2
        WHERE m.chat_id = $1
          AND m.deleted_at IS NULL
          AND m.sender_id <> $2
          AND mr.msg_id IS NULL
        """,
        chat_id,
        current_user_id,
    )
    return row["first_unread_msg_id"] if row else None


async def mark_read_upto(conn, chat_id: int, current_user_id: int, upto_msg_id: int):
    if not upto_msg_id:
        return 0

    rows = await conn.fetch(
        """
        INSERT INTO message_reads (msg_id, user_id, read_at)
        SELECT m.msg_id, $2, NOW()
        FROM messages m
        LEFT JOIN message_reads mr
            ON mr.msg_id = m.msg_id
           AND mr.user_id = $2
        WHERE m.chat_id = $1
          AND m.msg_id <= $3
          AND m.sender_id <> $2
          AND m.deleted_at IS NULL
          AND mr.msg_id IS NULL
        ON CONFLICT (msg_id, user_id) DO NOTHING
        RETURNING msg_id
        """,
        chat_id,
        current_user_id,
        upto_msg_id,
    )
    return len(rows)
