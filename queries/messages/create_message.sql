INSERT INTO messages (chat_id, sender_id, content, reply_msg_id, sent_at)
VALUES ($1, $2, $3, $4, NOW())
RETURNING msg_id
