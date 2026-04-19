UPDATE users
SET
    name = $2,
    surname = $3,
    patronym = $4,
    nickname = $5,
    email = $6,
    phone = $7,
    sex = $8,
    marital_status_id = $9,
    city_id = $10
WHERE id = $1
RETURNING id;
