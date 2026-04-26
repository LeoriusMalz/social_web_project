SELECT
    u.id,
    u.name,
    u.surname,
    (u.avatar IS NOT NULL) AS has_avatar
FROM friendships f
JOIN users u
  ON u.id = CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END
WHERE (f.user1_id = $1 OR f.user2_id = $1)
  AND f.deleted_at IS NULL
  AND ($2 = '' OR LOWER(COALESCE(u.surname, '') || ' ' || COALESCE(u.name, '')) LIKE $2)
ORDER BY u.surname, u.name
