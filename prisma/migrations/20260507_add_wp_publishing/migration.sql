-- WordPress publishing credentials per client.
-- wpAppPasswordEnc is AES-256-GCM encrypted; key comes from ENCRYPTION_KEY env var.
ALTER TABLE "Client" ADD COLUMN "wpUrl"            TEXT;
ALTER TABLE "Client" ADD COLUMN "wpUsername"       TEXT;
ALTER TABLE "Client" ADD COLUMN "wpAppPasswordEnc" TEXT;
