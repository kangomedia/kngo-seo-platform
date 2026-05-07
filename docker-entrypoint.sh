#!/bin/sh
set -e

echo "🔄 Checking migration state..."

# If the _prisma_migrations table does not exist, this database was previously
# managed by `prisma db push`. We baseline by marking every existing migration
# as applied without running it (the columns/tables already exist from db push).
SHOULD_BASELINE=$(node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='_prisma_migrations') AS e\")
  .then(r => { console.log(r.rows[0].e ? 'no' : 'yes'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); process.exit(1); });
")

if [ "$SHOULD_BASELINE" = "yes" ]; then
  echo "📝 No migration history found. Baselining existing migrations as applied..."
  for dir in prisma/migrations/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    echo "  ↪ marking '$name' as applied"
    npx prisma migrate resolve --applied "$name"
  done
fi

echo "🔄 Applying pending migrations..."
npx prisma migrate deploy

echo "✅ Starting application..."
exec node server.js
