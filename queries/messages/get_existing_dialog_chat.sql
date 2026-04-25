SELECT p1.chat_id
FROM participation p1
JOIN participation p2 ON p2.chat_id = p1.chat_id
JOIN chats c ON c.chat_id = p1.chat_id
WHERE p1.user_id = $1
  AND p2.user_id = $2
  AND p1.left_at IS NULL
  AND p2.left_at IS NULL
  AND c.type_id = $3
ORDER BY p1.chat_id DESC
LIMIT 1
