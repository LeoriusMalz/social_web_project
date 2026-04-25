SELECT msg_id
FROM messages
WHERE msg_id = $1
  AND chat_id = $2
  AND deleted_at IS NULL
