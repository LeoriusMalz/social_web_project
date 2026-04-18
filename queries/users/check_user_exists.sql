SELECT
    EXISTS(SELECT 1 FROM users WHERE LOWER(nickname) = LOWER($1)) AS nickname_exists,
    EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($2)) AS email_exists;
