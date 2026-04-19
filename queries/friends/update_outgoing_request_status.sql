UPDATE requests
SET request_status_id = $3,
    decision_at = NOW()
WHERE request_id = (
    SELECT request_id
    FROM requests
    WHERE from_user_id = $1
      AND to_user_id = $2
      AND request_status_id = $4
    ORDER BY request_id DESC
    LIMIT 1
)
RETURNING request_id;
