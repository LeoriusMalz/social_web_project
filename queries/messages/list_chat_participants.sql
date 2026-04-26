WITH latest AS (
    SELECT DISTINCT ON (p.user_id)
        p.user_id, p.role_id, p.left_at, p.kicked_by
    FROM participation p
    WHERE p.chat_id = $1
    ORDER BY p.user_id, p.part_id DESC
)
SELECT
    u.id,
    u.name,
    u.surname,
    (u.avatar IS NOT NULL) AS has_avatar,
    l.role_id,
    l.left_at,
    l.kicked_by
FROM latest l
JOIN users u ON u.id = l.user_id
WHERE l.left_at IS NULL
ORDER BY l.role_id DESC, l.left_at NULLS FIRST, u.surname, u.name
