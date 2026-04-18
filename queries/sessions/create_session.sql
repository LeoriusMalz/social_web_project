INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, $4, $5)
RETURNING session_id;
