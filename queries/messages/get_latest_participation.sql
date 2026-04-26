SELECT part_id, role_id, joined_at, left_at, kicked_by
FROM participation
WHERE chat_id = $1 AND user_id = $2
ORDER BY part_id DESC
LIMIT 1
