SELECT
    u.id,
    u.name,
    u.surname,
    u.patronym,
    u.nickname
FROM friendships f
JOIN users u
  ON u.id = CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END
WHERE (f.user1_id = $1 OR f.user2_id = $1)
  AND f.deleted_at IS NULL
ORDER BY u.surname, u.name;
