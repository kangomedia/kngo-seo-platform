-- Add isArchived column to Report table
ALTER TABLE "Report" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
