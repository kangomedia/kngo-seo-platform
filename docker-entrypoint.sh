#!/bin/sh
set -e

echo "🔄 Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss

echo "✅ Database ready. Starting application..."
exec node server.js
