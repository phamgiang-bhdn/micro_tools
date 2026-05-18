-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "atCampaignId" TEXT,
ADD COLUMN     "atCategoryName" TEXT,
ADD COLUMN     "atCookieDurationSec" INTEGER,
ADD COLUMN     "atEndTime" TIMESTAMP(3),
ADD COLUMN     "atLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "atLogo" TEXT,
ADD COLUMN     "atMerchantUrl" TEXT,
ADD COLUMN     "atRawData" JSONB,
ADD COLUMN     "atScope" TEXT,
ADD COLUMN     "atStartTime" TIMESTAMP(3),
ADD COLUMN     "atSubCategory" TEXT,
ADD COLUMN     "categoryId" UUID,
ADD COLUMN     "filterRules" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_atCampaignId_key" ON "Campaign"("atCampaignId");

-- CreateIndex
CREATE INDEX "Campaign_atCampaignId_idx" ON "Campaign"("atCampaignId");

-- CreateIndex
CREATE INDEX "Campaign_categoryId_idx" ON "Campaign"("categoryId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
