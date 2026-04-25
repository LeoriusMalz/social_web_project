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
