INSERT INTO users (name, surname, phone, nickname, email)
VALUES ('-', '-', '-', $1, $2)
RETURNING id, nickname, email;