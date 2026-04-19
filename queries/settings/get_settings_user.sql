SELECT
    u.id,
    u.name,
    u.surname,
    u.patronym,
    u.nickname,
    u.email,
    u.phone,
    u.sex,
    u.marital_status_id,
    u.city_id,
    c.city_name AS city,
    (u.avatar IS NOT NULL) AS has_avatar
FROM users u
LEFT JOIN cities c ON c.city_id = u.city_id
WHERE u.id = $1;
