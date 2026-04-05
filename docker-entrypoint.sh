#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "✅ Migrations complete. Starting application..."
exec node server.js
