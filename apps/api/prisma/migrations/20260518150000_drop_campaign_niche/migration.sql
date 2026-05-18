-- Drop CampaignNiche table. PR5 đã move filterRules sang Campaign.filterRules.
-- Niche admin gán tay vào Product trong /admin/products (PR4), không cần N:N gate ở Campaign nữa.

ALTER TABLE "CampaignNiche" DROP CONSTRAINT IF EXISTS "CampaignNiche_campaignId_fkey";
ALTER TABLE "CampaignNiche" DROP CONSTRAINT IF EXISTS "CampaignNiche_nicheId_fkey";

DROP TABLE IF EXISTS "CampaignNiche";
