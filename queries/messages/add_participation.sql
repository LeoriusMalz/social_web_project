INSERT INTO participation (user_id, chat_id, role_id, joined_at, invited_by)
VALUES ($1, $2, $3, NOW(), $4)
