-- Dedupe existing rows, then add a unique constraint on (clientId, month, year, name).
-- This prevents the duplicate-deliverable bug at the schema level so we can
-- delete the manual cleanup utility.

-- Step 1: keep the oldest row per (clientId, month, year, name); delete the rest.
DELETE FROM "Deliverable" a
USING "Deliverable" b
WHERE a."createdAt" > b."createdAt"
  AND a."clientId" = b."clientId"
  AND a."month"    = b."month"
  AND a."year"     = b."year"
  AND a."name"     = b."name";

-- Step 2: add the unique constraint.
CREATE UNIQUE INDEX "Deliverable_clientId_month_year_name_key"
  ON "Deliverable"("clientId", "month", "year", "name");
