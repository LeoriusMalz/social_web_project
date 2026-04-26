SELECT 1
FROM participation
WHERE chat_id = $1
  AND user_id = $2
ORDER BY part_id DESC
LIMIT 1
