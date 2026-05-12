-- Inline annotations the client leaves on a specific selection of a draft.
-- One ContentPiece can have many PieceAnnotations. Created on demand from
-- the client review portal. Anchored only by the verbatim quoted text —
-- we do NOT track DOM offsets because they break the instant a draft is
-- edited.

CREATE TABLE IF NOT EXISTS "PieceAnnotation" (
    "id"              TEXT NOT NULL,
    "contentPieceId"  TEXT NOT NULL,
    "highlightedText" TEXT NOT NULL,
    "comment"         TEXT NOT NULL,
    "resolved"        BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PieceAnnotation_contentPieceId_idx"
  ON "PieceAnnotation"("contentPieceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PieceAnnotation_contentPieceId_fkey'
  ) THEN
    ALTER TABLE "PieceAnnotation"
      ADD CONSTRAINT "PieceAnnotation_contentPieceId_fkey"
      FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
