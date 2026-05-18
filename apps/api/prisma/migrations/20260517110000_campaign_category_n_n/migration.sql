-- CreateTable CampaignCategory (N:N join giữa Campaign và Category, per-pair filterRules + priority)
CREATE TABLE "CampaignCategory" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "filterRules" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCategory_pkey" PRIMARY KEY ("id")
);

-- DropForeignKey + DropIndex + DropColumn cho Campaign.categoryId / filterRules cũ (1:N → N:N migration).
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_categoryId_fkey";
DROP INDEX "Campaign_categoryId_idx";
ALTER TABLE "Campaign" DROP COLUMN "categoryId",
DROP COLUMN "filterRules";

-- AddForeignKey
ALTER TABLE "CampaignCategory" ADD CONSTRAINT "CampaignCategory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignCategory" ADD CONSTRAINT "CampaignCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCategory_campaignId_categoryId_key" ON "CampaignCategory"("campaignId", "categoryId");
CREATE INDEX "CampaignCategory_campaignId_priority_idx" ON "CampaignCategory"("campaignId", "priority");
CREATE INDEX "CampaignCategory_categoryId_idx" ON "CampaignCategory"("categoryId");
