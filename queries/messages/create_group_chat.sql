INSERT INTO chats (type_id, created_at, created_by, title)
VALUES ($1, $2, $3, $4)
RETURNING chat_id
