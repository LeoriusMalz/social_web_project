DELETE FROM reactions
WHERE post_id = $1 AND reaction_by = $2;
