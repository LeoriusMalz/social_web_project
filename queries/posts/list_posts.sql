SELECT
    p.post_id,
    p.post_by,
    p.created_at,
    p.text_content,
    p.file_content IS NOT NULL AS has_file,

    COALESCE(COUNT(*) FILTER (WHERE r.is_liked = TRUE), 0)::INT AS likes_count,
    COALESCE(COUNT(*) FILTER (WHERE r.is_liked = FALSE), 0)::INT AS dislikes_count,

    COALESCE(BOOL_OR(r.reaction_by = $2 AND r.is_liked = TRUE), FALSE) AS is_liked_by_me,
    COALESCE(BOOL_OR(r.reaction_by = $2 AND r.is_liked = FALSE), FALSE) AS is_disliked_by_me
FROM posts p
LEFT JOIN reactions r ON r.post_id = p.post_id
WHERE p.post_by = $1
  AND ($4::INT IS NULL OR p.post_id < $4)
GROUP BY p.post_id
ORDER BY p.post_id DESC
LIMIT $3;