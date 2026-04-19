SELECT
    u.id,
    u.name,
    u.surname,
    u.patronym,
    u.nickname,
    'incoming' AS relation,
    r.request_id
FROM requests r
JOIN users u ON u.id = r.from_user_id
WHERE r.to_user_id = $1
  AND r.request_status_id = $2
ORDER BY r.sent_at DESC;
