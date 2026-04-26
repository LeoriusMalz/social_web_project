SELECT
    u.id,
    u.name,
    u.surname,
    u.nickname,
    (u.avatar IS NOT NULL) AS has_avatar
FROM reactions r
JOIN users u ON u.id = r.reaction_by
WHERE r.post_id = $1
  AND r.is_liked = $2
ORDER BY r.reacted_at DESC;
