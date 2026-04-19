INSERT INTO friendships (user1_id, user2_id, request_id, added_at, deleted_at, deleted_by)
VALUES ($1, $2, $3, NOW(), NULL, NULL)
ON CONFLICT (user1_id, user2_id)
DO UPDATE SET
    request_id = EXCLUDED.request_id,
    added_at = NOW(),
    deleted_at = NULL,
    deleted_by = NULL;
