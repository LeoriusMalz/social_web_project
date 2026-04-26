SELECT MIN(m.msg_id)::INT AS first_unread_msg_id
FROM messages m
LEFT JOIN message_reads mr ON mr.msg_id = m.msg_id AND mr.user_id = $2
WHERE m.chat_id = $1
  AND m.deleted_at IS NULL
  AND m.sender_id <> $2
  AND mr.msg_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM participation p_vis
      WHERE p_vis.chat_id = m.chat_id
        AND p_vis.user_id = $2
        AND m.sent_at >= p_vis.joined_at
        AND (p_vis.left_at IS NULL OR m.sent_at <= p_vis.left_at)
  )
