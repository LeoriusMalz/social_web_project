SELECT
    u.id,
    u.name,
    u.surname,
    u.patronym,
    u.nickname,
    CASE
        WHEN f.user1_id IS NOT NULL THEN 'friend'
        WHEN ro.request_id IS NOT NULL THEN 'outgoing'
        WHEN ri.request_id IS NOT NULL THEN 'incoming'
        ELSE 'none'
    END AS relation
FROM users u
LEFT JOIN friendships f
    ON f.user1_id = LEAST($1, u.id)
   AND f.user2_id = GREATEST($1, u.id)
   AND f.deleted_at IS NULL
LEFT JOIN LATERAL (
    SELECT r.request_id
    FROM requests r
    WHERE r.from_user_id = $1
      AND r.to_user_id = u.id
      AND r.request_status_id = $3
    ORDER BY r.request_id DESC
    LIMIT 1
) ro ON true
LEFT JOIN LATERAL (
    SELECT r.request_id
    FROM requests r
    WHERE r.from_user_id = u.id
      AND r.to_user_id = $1
      AND r.request_status_id = $3
    ORDER BY r.request_id DESC
    LIMIT 1
) ri ON true
WHERE u.id <> $1
  AND (
    LOWER(u.name || ' ' || u.surname) LIKE $2
    OR LOWER(u.surname || ' ' || u.name) LIKE $2
    OR LOWER(u.nickname) LIKE $2
  )
ORDER BY u.surname, u.name
LIMIT 100;
