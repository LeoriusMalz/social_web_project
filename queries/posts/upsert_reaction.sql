INSERT INTO reactions (post_id, reaction_by, reacted_at, is_liked)
VALUES ($1, $2, NOW(), $3)
ON CONFLICT (post_id, reaction_by)
DO UPDATE
SET is_liked = EXCLUDED.is_liked,
    reacted_at = NOW();
