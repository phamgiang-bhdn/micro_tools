-- AlterTable: ConversionWebhook.network missing in DB but referenced in schema + admin queries.
ALTER TABLE "ConversionWebhook"
  ADD COLUMN IF NOT EXISTS "network" "AffiliateNetwork" NOT NULL DEFAULT 'ACCESSTRADE';

-- CreateIndex (matches schema's @@index([network, receivedAt]))
CREATE INDEX IF NOT EXISTS "ConversionWebhook_network_receivedAt_idx"
  ON "ConversionWebhook"("network", "receivedAt");
