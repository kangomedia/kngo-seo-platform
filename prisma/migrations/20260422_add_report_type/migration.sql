-- Add type column to Report table
ALTER TABLE "Report" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'MONTHLY';
