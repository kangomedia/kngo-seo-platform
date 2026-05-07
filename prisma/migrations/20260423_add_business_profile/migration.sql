-- AlterTable: Add business profile fields for AI keyword targeting
ALTER TABLE "Client" ADD COLUMN "businessDescription" TEXT;
ALTER TABLE "Client" ADD COLUMN "primaryServices"     TEXT;
ALTER TABLE "Client" ADD COLUMN "idealClientProfile"  TEXT;
ALTER TABLE "Client" ADD COLUMN "priceRange"          TEXT;
ALTER TABLE "Client" ADD COLUMN "industryVertical"    TEXT;
