WITH base AS (
    SELECT
        m.msg_id,
        m.chat_id,
        m.sender_id,
        m.content,
        m.reply_msg_id,
        m.sent_at,
        m.updated_at,
        m.is_system,
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
      AND EXISTS (
          SELECT 1
          FROM participation p_vis
          WHERE p_vis.chat_id = m.chat_id
            AND p_vis.user_id = $2
            AND m.sent_at >= p_vis.joined_at
            AND (p_vis.left_at IS NULL OR m.sent_at <= p_vis.left_at)
      )
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
