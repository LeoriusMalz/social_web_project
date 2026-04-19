SELECT request_id
FROM requests
WHERE from_user_id = $1
  AND to_user_id = $2
  AND request_status_id = $3
ORDER BY request_id DESC
LIMIT 1;
