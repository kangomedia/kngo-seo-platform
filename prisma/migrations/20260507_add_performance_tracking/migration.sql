-- Performance / ROI tracking.
--
-- Adds:
--   1. Per-client config for branded-query detection and CPC used in
--      "estimated traffic value" math.
--   2. MonthlySnapshot table — month-end aggregates of GSC + GA4 + engagement
--      events + estimated traffic value, frozen so trends survive upstream
--      reconfiguration.
--
-- All ALTERs are guarded with IF NOT EXISTS so the migration is idempotent.

-- 1. Client performance config
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "brandTerms" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "avgCpcUsd"  DOUBLE PRECISION NOT NULL DEFAULT 3.50;

-- 2. MonthlySnapshot table
CREATE TABLE IF NOT EXISTS "MonthlySnapshot" (
    "id"                  TEXT             NOT NULL,
    "clientId"            TEXT             NOT NULL,
    "month"               INTEGER          NOT NULL,
    "year"                INTEGER          NOT NULL,

    "gscClicks"           INTEGER          NOT NULL DEFAULT 0,
    "gscImpressions"      INTEGER          NOT NULL DEFAULT 0,
    "gscBrandedClicks"    INTEGER          NOT NULL DEFAULT 0,
    "gscNonBrandedClicks" INTEGER          NOT NULL DEFAULT 0,
    "gscAvgPosition"      DOUBLE PRECISION,

    "ga4Sessions"         INTEGER          NOT NULL DEFAULT 0,
    "ga4Users"            INTEGER          NOT NULL DEFAULT 0,
    "ga4OrganicSessions"  INTEGER          NOT NULL DEFAULT 0,
    "ga4PageViews"        INTEGER          NOT NULL DEFAULT 0,

    "phoneClicks"         INTEGER          NOT NULL DEFAULT 0,
    "formSubmits"         INTEGER          NOT NULL DEFAULT 0,
    "emailClicks"         INTEGER          NOT NULL DEFAULT 0,

    "estTrafficValue"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpcUsedUsd"          DOUBLE PRECISION NOT NULL DEFAULT 0,

    "pageData"            TEXT,
    "queryData"           TEXT,

    "generatedAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlySnapshot_clientId_month_year_key"
  ON "MonthlySnapshot"("clientId", "month", "year");

CREATE INDEX IF NOT EXISTS "MonthlySnapshot_clientId_year_month_idx"
  ON "MonthlySnapshot"("clientId", "year", "month");

-- FK with idempotent guard (Postgres has no IF NOT EXISTS for constraints
-- pre-9.6 in a portable way; use the catalog check).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MonthlySnapshot_clientId_fkey'
  ) THEN
    ALTER TABLE "MonthlySnapshot"
      ADD CONSTRAINT "MonthlySnapshot_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
