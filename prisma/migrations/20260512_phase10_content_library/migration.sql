-- Phase 10 — Published Content Library + Internal Linking + Distribution Assets
--
-- Adds three new columns to ContentPiece and one new table for internal
-- links. Idempotent (IF NOT EXISTS / DO-block guards) so the migration is
-- safe to re-apply if Prisma's migration history is ever out of sync with
-- the actual DB state.

-- ── ContentPiece new columns ─────────────────────────────────────────
ALTER TABLE "ContentPiece" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "ContentPiece" ADD COLUMN IF NOT EXISTS "socialPosts"     TEXT;
ALTER TABLE "ContentPiece" ADD COLUMN IF NOT EXISTS "slug"            TEXT;

-- ── InternalLinkStatus enum ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InternalLinkStatus') THEN
    CREATE TYPE "InternalLinkStatus" AS ENUM ('PENDING', 'RESOLVED', 'BROKEN');
  END IF;
END $$;

-- ── InternalLink table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InternalLink" (
    "id"          TEXT                  NOT NULL,
    "fromPieceId" TEXT                  NOT NULL,
    "toPieceId"   TEXT,
    "plannedSlug" TEXT                  NOT NULL,
    "anchorText"  TEXT                  NOT NULL,
    "status"      "InternalLinkStatus"  NOT NULL DEFAULT 'PENDING',
    "createdAt"   TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"  TIMESTAMP(3),
    CONSTRAINT "InternalLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InternalLink_fromPieceId_idx" ON "InternalLink"("fromPieceId");
CREATE INDEX IF NOT EXISTS "InternalLink_plannedSlug_idx" ON "InternalLink"("plannedSlug");
CREATE INDEX IF NOT EXISTS "InternalLink_status_idx"      ON "InternalLink"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InternalLink_fromPieceId_fkey'
  ) THEN
    ALTER TABLE "InternalLink"
      ADD CONSTRAINT "InternalLink_fromPieceId_fkey"
      FOREIGN KEY ("fromPieceId") REFERENCES "ContentPiece"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InternalLink_toPieceId_fkey'
  ) THEN
    ALTER TABLE "InternalLink"
      ADD CONSTRAINT "InternalLink_toPieceId_fkey"
      FOREIGN KEY ("toPieceId") REFERENCES "ContentPiece"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
