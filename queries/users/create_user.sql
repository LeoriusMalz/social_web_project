INSERT INTO users (name, surname, patronym, nickname, email, sex, password_hash, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
RETURNING id, nickname, email;
