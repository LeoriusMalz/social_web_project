SELECT EXISTS(
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER($1)
      AND id <> $2
) AS is_taken;
