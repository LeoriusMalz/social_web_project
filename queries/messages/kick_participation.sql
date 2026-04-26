UPDATE participation
SET left_at = NOW(), kicked_by = $2
WHERE part_id = $1
