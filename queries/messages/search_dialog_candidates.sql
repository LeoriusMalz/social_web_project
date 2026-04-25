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
