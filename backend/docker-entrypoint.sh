#!/bin/sh
set -e

echo "🔧 Enabling pgvector extension..."

# Parse DATABASE_URL untuk koneksi psql
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || \
  echo "⚠️  Could not create vector extension (may already exist or insufficient permissions)"

echo "📦 Running Prisma db push..."
npx prisma db push --skip-generate

echo "🚀 Starting server..."
exec node dist/main.js
