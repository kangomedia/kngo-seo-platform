-- Add an expiration timestamp to public report links.
-- NULL = no expiry (back-compat with existing reports).
ALTER TABLE "Report" ADD COLUMN "expiresAt" TIMESTAMP(3);
