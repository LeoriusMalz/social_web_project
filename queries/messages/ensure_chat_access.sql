SELECT 1
FROM participation
WHERE chat_id = $1
  AND user_id = $2
  AND left_at IS NULL
