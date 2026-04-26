SELECT user_id
FROM participation p
WHERE p.chat_id = $1
  AND p.left_at IS NULL
  AND p.part_id = (
      SELECT p2.part_id
      FROM participation p2
      WHERE p2.chat_id = p.chat_id
        AND p2.user_id = p.user_id
      ORDER BY p2.part_id DESC
      LIMIT 1
  )
