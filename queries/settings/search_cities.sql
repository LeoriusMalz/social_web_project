SELECT city_id, city_name
FROM cities
WHERE LOWER(city_name) LIKE $1
ORDER BY city_name
LIMIT 25;
