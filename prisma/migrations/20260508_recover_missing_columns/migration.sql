-- Recovery migration.
--
-- The previous entrypoint baselined the 20260507_* migrations as "applied"
-- without actually running their SQL on databases that had been managed via
-- `prisma db push`. As a result, the schema drifted: Prisma thought the new
-- columns existed, but the database didn't have them.
--
-- This migration re-applies those changes idempotently (IF NOT EXISTS), so
-- it's safe whether the columns are already present or not.

-- WordPress publishing fields on Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "wpUrl"            TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "wpUsername"       TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "wpAppPasswordEnc" TEXT;

-- Public-report expiration
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- Deliverable dedupe + unique constraint. The DELETE is harmless if no dupes
-- exist; the index creation is guarded by IF NOT EXISTS.
DELETE FROM "Deliverable" a
USING "Deliverable" b
WHERE a."createdAt" > b."createdAt"
  AND a."clientId" = b."clientId"
  AND a."month"    = b."month"
  AND a."year"     = b."year"
  AND a."name"     = b."name";

CREATE UNIQUE INDEX IF NOT EXISTS "Deliverable_clientId_month_year_name_key"
  ON "Deliverable"("clientId", "month", "year", "name");
