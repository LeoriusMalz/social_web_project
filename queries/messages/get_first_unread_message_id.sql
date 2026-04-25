SELECT MIN(m.msg_id) AS first_unread_msg_id
FROM messages m
LEFT JOIN message_reads mr
    ON mr.msg_id = m.msg_id
   AND mr.user_id = $2
WHERE m.chat_id = $1
  AND m.deleted_at IS NULL
  AND m.sender_id <> $2
  AND mr.msg_id IS NULL
