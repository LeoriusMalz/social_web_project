INSERT INTO requests (from_user_id, to_user_id, request_status_id, sent_at)
VALUES ($1, $2, $3, NOW())
RETURNING request_id;
