INSERT INTO posts (post_by, text_content, file_content, created_at)
VALUES ($1, $2, $3, NOW())
RETURNING post_id;
