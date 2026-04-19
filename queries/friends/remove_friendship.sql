UPDATE friendships
SET deleted_at = NOW(),
    deleted_by = $3
WHERE user1_id = $1
  AND user2_id = $2
  AND deleted_at IS NULL
RETURNING user1_id;
