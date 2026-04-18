SELECT session_id, user_id, expires_at
FROM user_sessions
WHERE token_hash = $1
  AND revoked_at IS NULL
  AND expires_at > NOW()
LIMIT 1;
