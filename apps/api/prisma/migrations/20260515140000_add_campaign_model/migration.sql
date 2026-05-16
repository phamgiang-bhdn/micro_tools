-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('APPLIED', 'APPROVED', 'REJECTED', 'PAUSED', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable Campaign
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "network" "AffiliateNetwork" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "commissionNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_network_externalId_key" ON "Campaign"("network", "externalId");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_network_status_idx" ON "Campaign"("network", "status");

-- AlterTable Product — add campaignId FK
ALTER TABLE "Product" ADD COLUMN "campaignId" UUID;
CREATE INDEX "Product_campaignId_idx" ON "Product"("campaignId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable ConversionWebhook — add campaignId FK
ALTER TABLE "ConversionWebhook" ADD COLUMN "campaignId" UUID;
CREATE INDEX "ConversionWebhook_campaignId_receivedAt_idx" ON "ConversionWebhook"("campaignId", "receivedAt");
ALTER TABLE "ConversionWebhook" ADD CONSTRAINT "ConversionWebhook_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
