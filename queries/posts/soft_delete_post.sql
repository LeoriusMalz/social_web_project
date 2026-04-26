UPDATE posts
SET is_deleted = TRUE
WHERE post_id = $1
  AND post_by = $2
  AND is_deleted = FALSE;
