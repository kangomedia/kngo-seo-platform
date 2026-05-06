-- Add isReserve flag to ContentPiece
-- Reserve pieces are the 2x overflow; only shown to clients when they reject a primary piece
ALTER TABLE "ContentPiece" ADD COLUMN "isReserve" BOOLEAN NOT NULL DEFAULT false;
