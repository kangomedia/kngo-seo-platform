-- Full strategy layer: per-query CPC, ICP pains, structured competitors,
-- research mode tagging. All ALTERs guarded with IF NOT EXISTS.

-- 1. Per-keyword CPC on tracked Keyword rows
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "cpc" DOUBLE PRECISION;

-- 2. ICP pains capture on Client (drives pain-point keyword research)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "icpPains" TEXT;

-- 3. Research mode + pillar tagging on KeywordResearch
ALTER TABLE "KeywordResearch" ADD COLUMN IF NOT EXISTS "mode"       TEXT NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "KeywordResearch" ADD COLUMN IF NOT EXISTS "pillarSlug" TEXT;

-- 4. KeywordCpc cache table — DataForSEO Google Ads CPC values
CREATE TABLE IF NOT EXISTS "KeywordCpc" (
    "id"           TEXT             NOT NULL,
    "keyword"      TEXT             NOT NULL,
    "locationCode" INTEGER          NOT NULL,
    "cpc"          DOUBLE PRECISION,
    "competition"  DOUBLE PRECISION,
    "searchVolume" INTEGER,
    "fetchedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeywordCpc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KeywordCpc_keyword_locationCode_key"
  ON "KeywordCpc"("keyword", "locationCode");

CREATE INDEX IF NOT EXISTS "KeywordCpc_fetchedAt_idx"
  ON "KeywordCpc"("fetchedAt");

-- 5. Competitor table — structured replacement for Client.competitors JSON
CREATE TABLE IF NOT EXISTS "Competitor" (
    "id"             TEXT             NOT NULL,
    "clientId"       TEXT             NOT NULL,
    "domain"         TEXT             NOT NULL,
    "classification" TEXT             NOT NULL DEFAULT 'PEER',
    "reasoning"      TEXT,
    "pillarSlug"     TEXT,
    "isAccepted"     BOOLEAN          NOT NULL DEFAULT TRUE,
    "source"         TEXT             NOT NULL DEFAULT 'manual',
    "domainRank"     INTEGER,
    "estTraffic"     INTEGER,
    "discoveredAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Competitor_clientId_domain_key"
  ON "Competitor"("clientId", "domain");

CREATE INDEX IF NOT EXISTS "Competitor_clientId_isAccepted_idx"
  ON "Competitor"("clientId", "isAccepted");

CREATE INDEX IF NOT EXISTS "Competitor_clientId_classification_idx"
  ON "Competitor"("clientId", "classification");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Competitor_clientId_fkey'
  ) THEN
    ALTER TABLE "Competitor"
      ADD CONSTRAINT "Competitor_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Backfill Competitor rows from existing Client.competitors JSON arrays.
-- This is idempotent: ON CONFLICT DO NOTHING on the (clientId, domain) unique.
INSERT INTO "Competitor" ("id", "clientId", "domain", "classification", "isAccepted", "source", "discoveredAt")
SELECT
  -- prisma cuid format isn't replicable in pure SQL; use a deterministic-ish id
  'comp_' || md5(c."id" || '|' || elem)        AS "id",
  c."id"                                       AS "clientId",
  trim(both '"' from elem::text)               AS "domain",
  'PEER'                                       AS "classification",
  TRUE                                         AS "isAccepted",
  'wizard'                                     AS "source",
  CURRENT_TIMESTAMP                            AS "discoveredAt"
FROM "Client" c,
     LATERAL jsonb_array_elements_text(
       CASE
         WHEN c."competitors" IS NULL THEN '[]'::jsonb
         WHEN c."competitors" = '' THEN '[]'::jsonb
         ELSE c."competitors"::jsonb
       END
     ) AS elem
WHERE c."competitors" IS NOT NULL
  AND c."competitors" <> ''
  AND trim(both '"' from elem::text) <> ''
ON CONFLICT ("clientId", "domain") DO NOTHING;
