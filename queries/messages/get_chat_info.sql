WITH me_part AS (
    SELECT p.*
    FROM participation p
    WHERE p.chat_id = $1
      AND p.user_id = $2
    ORDER BY p.part_id DESC
    LIMIT 1
)
SELECT
    c.chat_id,
    c.type_id,
    c.title,
    (c.avatar IS NOT NULL) AS has_avatar,
    c.created_by,
    (
        SELECT COUNT(*)
        FROM participation p_count
        WHERE p_count.chat_id = c.chat_id
          AND p_count.left_at IS NULL
          AND p_count.part_id = (
              SELECT p_last.part_id
              FROM participation p_last
              WHERE p_last.chat_id = p_count.chat_id
                AND p_last.user_id = p_count.user_id
              ORDER BY p_last.part_id DESC
              LIMIT 1
          )
    )::INT AS participant_count,
    me_part.role_id,
    me_part.left_at,
    me_part.kicked_by,
    peer.id AS peer_id,
    peer.name AS peer_name,
    peer.surname AS peer_surname,
    peer.has_avatar AS peer_has_avatar
FROM chats c
JOIN me_part ON true
LEFT JOIN LATERAL (
    SELECT
        u.id,
        u.name,
        u.surname,
        (u.avatar IS NOT NULL) AS has_avatar
    FROM participation p_peer
    JOIN users u ON u.id = p_peer.user_id
    WHERE p_peer.chat_id = c.chat_id
      AND p_peer.user_id <> $2
      AND p_peer.left_at IS NULL
    ORDER BY p_peer.part_id DESC
    LIMIT 1
) peer ON c.type_id = 0
WHERE c.chat_id = $1
