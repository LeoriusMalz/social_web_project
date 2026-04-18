SELECT id, nickname, email, password_hash
FROM users
WHERE LOWER(nickname) = LOWER($1)
   OR LOWER(email) = LOWER($1)
LIMIT 1;
