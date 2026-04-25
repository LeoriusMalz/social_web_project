INSERT INTO chats (type_id, created_at, created_by)
VALUES ($1, $2, $3)
RETURNING chat_id
