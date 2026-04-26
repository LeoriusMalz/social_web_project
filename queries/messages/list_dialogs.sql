WITH visible_messages AS (
    SELECT m.*
    FROM messages m
    WHERE m.deleted_at IS NULL
      AND EXISTS (
          SELECT 1
          FROM participation p_vis
          WHERE p_vis.chat_id = m.chat_id
            AND p_vis.user_id = $1
            AND m.sent_at >= p_vis.joined_at
            AND (p_vis.left_at IS NULL OR m.sent_at <= p_vis.left_at)
      )
),
latest AS (
    SELECT DISTINCT ON (m.chat_id)
        m.chat_id,
        m.msg_id,
        m.sender_id,
        m.content,
        m.sent_at,
        m.updated_at,
        m.is_system
    FROM visible_messages m
    ORDER BY m.chat_id, m.msg_id DESC
),
unread AS (
    SELECT m.chat_id,
           COUNT(*)::INT AS unread_count,
           MIN(m.msg_id)::INT AS first_unread_msg_id
    FROM visible_messages m
    LEFT JOIN message_reads mr
        ON mr.msg_id = m.msg_id
       AND mr.user_id = $1
    WHERE m.sender_id <> $1
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
    JOIN chats c ON c.chat_id = p1.chat_id
    JOIN participation p2 ON p2.chat_id = p1.chat_id
        AND p2.user_id <> p1.user_id
        AND p2.left_at IS NULL
    JOIN users u ON u.id = p2.user_id
    WHERE p1.user_id = $1
      AND p1.part_id = (
          SELECT p1x.part_id
          FROM participation p1x
          WHERE p1x.chat_id = p1.chat_id
            AND p1x.user_id = p1.user_id
          ORDER BY p1x.part_id DESC
          LIMIT 1
      )
      AND c.type_id = 0
),
sender AS (
    SELECT u.id AS sender_id, u.name AS sender_name, u.surname AS sender_surname
    FROM users u
)
SELECT
    l.chat_id,
    c.type_id,
    c.title,
    (c.avatar IS NOT NULL) AS chat_has_avatar,
    l.msg_id AS last_msg_id,
    l.sender_id AS last_sender_id,
    l.content AS last_message,
    l.sent_at AS last_message_sent_at,
    l.updated_at AS last_message_updated_at,
    l.is_system,
    p.peer_id,
    p.name AS peer_name,
    p.surname AS peer_surname,
    p.has_avatar AS peer_has_avatar,
    s.sender_name,
    s.sender_surname,
    COALESCE(unread.unread_count, 0) AS unread_count,
    unread.first_unread_msg_id,
    EXISTS (
        SELECT 1
        FROM message_reads r
        WHERE r.msg_id = l.msg_id
          AND r.user_id <> $1
    ) AS last_my_message_seen_by_anyone
FROM latest l
JOIN chats c ON c.chat_id = l.chat_id
LEFT JOIN peer p ON p.chat_id = l.chat_id
LEFT JOIN sender s ON s.sender_id = l.sender_id
LEFT JOIN unread ON unread.chat_id = l.chat_id
ORDER BY l.msg_id DESC
LIMIT $2 OFFSET $3
