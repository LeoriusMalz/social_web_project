INSERT INTO messages (chat_id, sender_id, content, sent_at, is_system)
VALUES ($1, $2, $3, NOW(), TRUE)
RETURNING msg_id
