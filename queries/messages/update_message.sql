UPDATE messages
SET content = $1,
    updated_at = NOW()
WHERE msg_id = $2
  AND sender_id = $3
  AND deleted_at IS NULL
RETURNING msg_id, chat_id
