#!/bin/sh
set -e

echo "🔄 Checking migration state..."

# Detect two facts: does _prisma_migrations exist, and does the schema exist
# (we use the Client table as a sentinel — every install has it).
DB_STATE=$(node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
Promise.all([
  pool.query(\"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='_prisma_migrations') AS e\"),
  pool.query(\"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='Client') AS e\"),
]).then(([m, c]) => {
  console.log((m.rows[0].e ? 'M' : 'm') + (c.rows[0].e ? 'S' : 's'));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); process.exit(1); });
")

# Pre-baseline migrations: those that existed before we switched from
# `prisma db push` to `prisma migrate deploy`. On the one-time transition,
# their schema is already in the DB, so we mark them applied without running.
# DO NOT add new migrations to this list — they should run via migrate deploy.
PREBASELINE="20260422_add_report_type 20260423_add_business_profile 20260423_add_report_archived 20260505_add_isreserve"

case "$DB_STATE" in
  ms)
    # Empty database — bootstrap the schema with `db push`, then baseline all
    # existing migrations. After this, all future schema changes go through
    # versioned migrations.
    echo "📝 Empty database. Bootstrapping schema with prisma db push..."
    npx prisma db push --skip-generate
    echo "📝 Marking all existing migrations as applied (post-bootstrap)..."
    for dir in prisma/migrations/*/; do
      [ -d "$dir" ] || continue
      name=$(basename "$dir")
      [ "$name" = "migration_lock.toml" ] && continue
      echo "  ↪ baseline '$name'"
      npx prisma migrate resolve --applied "$name"
    done
    ;;
  mS)
    # Existing DB with no migration history — transitioning from `db push`.
    # Baseline only PRE-existing migrations; let new ones flow through deploy.
    echo "📝 Existing schema found without migration history. Baselining pre-existing migrations..."
    for name in $PREBASELINE; do
      if [ -d "prisma/migrations/$name" ]; then
        echo "  ↪ baseline '$name'"
        npx prisma migrate resolve --applied "$name"
      fi
    done
    ;;
  MS)
    echo "📝 Migration history found. Will apply any pending migrations."
    ;;
esac

echo "🔄 Running prisma migrate deploy..."
npx prisma migrate deploy

echo "✅ Starting application..."
exec node server.js
