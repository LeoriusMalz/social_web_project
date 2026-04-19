SELECT 1
FROM friendships
WHERE user1_id = $1
  AND user2_id = $2
  AND deleted_at IS NULL;
