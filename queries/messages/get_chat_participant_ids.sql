SELECT user_id
FROM participation
WHERE chat_id = $1
  AND left_at IS NULL
