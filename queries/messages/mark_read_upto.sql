INSERT INTO message_reads (msg_id, user_id, read_at)
SELECT m.msg_id, $2, NOW()
FROM messages m
LEFT JOIN message_reads mr
    ON mr.msg_id = m.msg_id
   AND mr.user_id = $2
WHERE m.chat_id = $1
  AND m.msg_id <= $3
  AND m.sender_id <> $2
  AND m.deleted_at IS NULL
  AND mr.msg_id IS NULL
ON CONFLICT (msg_id, user_id) DO NOTHING
RETURNING msg_id
