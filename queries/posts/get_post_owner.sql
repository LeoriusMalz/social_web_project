SELECT post_by
FROM posts
WHERE post_id = $1
  AND is_deleted = FALSE;
