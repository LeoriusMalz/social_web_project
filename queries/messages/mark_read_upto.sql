INSERT INTO message_reads (msg_id, user_id, read_at)
SELECT m.msg_id, $2, NOW()
FROM messages m
WHERE m.chat_id = $1
  AND m.msg_id <= $3
  AND m.sender_id <> $2
  AND m.deleted_at IS NULL
  AND EXISTS (
      SELECT 1
      FROM participation p_vis
      WHERE p_vis.chat_id = m.chat_id
        AND p_vis.user_id = $2
        AND m.sent_at >= p_vis.joined_at
        AND (p_vis.left_at IS NULL OR m.sent_at <= p_vis.left_at)
  )
ON CONFLICT (msg_id, user_id) DO NOTHING
RETURNING msg_id
