UPDATE messages
SET deleted_at = NOW(),
    deleted_by = $2
WHERE msg_id = $1
  AND sender_id = $2
  AND deleted_at IS NULL
RETURNING msg_id, chat_id
