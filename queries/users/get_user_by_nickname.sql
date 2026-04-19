SELECT
    u.id,
    u.name,
    u.surname,
    u.patronym,
    u.nickname,
    u.phone,
    u.email,
    u.sex,
    ms.status_name AS marital_status,
    c.city_name AS city,
    (
        SELECT COUNT(*)
        FROM friendships f
        WHERE (f.user1_id = u.id OR f.user2_id = u.id)
          AND f.deleted_at IS NULL
    ) AS friends_count,
    (
        SELECT COUNT(*)
        FROM requests r
        WHERE r.to_user_id = u.id
          AND r.request_status_id = 0
    ) AS followers_count
FROM users u
LEFT JOIN marital_statuses ms ON ms.status_id = u.marital_status_id
LEFT JOIN cities c ON c.city_id = u.city_id
WHERE LOWER(u.nickname) = LOWER($1)
LIMIT 1;