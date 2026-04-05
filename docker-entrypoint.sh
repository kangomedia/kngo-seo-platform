#!/bin/sh
set -e

echo "🔄 Syncing database schema..."
npx prisma db push --accept-data-loss 2>&1 || echo "⚠️ Schema sync had issues (app will still start)"

echo "✅ Starting application..."
exec node server.js
