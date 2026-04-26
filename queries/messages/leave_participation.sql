UPDATE participation
SET left_at = NOW(), kicked_by = $3
WHERE part_id = $1 AND user_id = $2
