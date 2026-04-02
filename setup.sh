#!/usr/bin/env bash

set -e

echo "Installing PostgreSQL..."

if ! brew list postgresql &> /dev/null
then
    brew install postgresql
fi

echo "Starting PostgreSQL..."
brew services start postgresql

echo "Installing Python dependencies..."

pip3 install fastapi uvicorn asyncpg pydantic python-dotenv

echo "Setting up database..."

DB_NAME="social_web_project"
DB_USER="admin"
DB_PASS="12345"

# Создание пользователя и БД
psql postgres <<EOF

-- Создаём пользователя (можно через DO)
DO \$\$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_roles WHERE rolname = '${DB_USER}'
   ) THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
   END IF;
END
\$\$;

EOF

# Создаём БД (отдельно!)
DB_EXISTS=$(psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")

if [ "$DB_EXISTS" != "1" ]; then
    echo "📦 Creating database..."
    createdb -O $DB_USER $DB_NAME
else
    echo "📦 Database already exists"
fi

echo "Creating .env file..."

cat <<EOL > .env
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
EOL

echo "Setup complete!"
echo ""
echo "DATABASE_URL:"
echo "postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo ""
echo "Run app:"
echo "uvicorn main:app --reload"