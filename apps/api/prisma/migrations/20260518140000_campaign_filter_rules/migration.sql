-- PR5: Move filterRules từ CampaignNiche → Campaign level.
-- Crawler không còn require CampaignNiche assignment để biết campaign nào eligible —
-- chỉ cần Campaign.status=APPROVED + atCampaignId + merchantName.

ALTER TABLE "Campaign" ADD COLUMN "filterRules" JSONB;

-- Backfill: lấy filterRules của assignment đầu tiên (lowest priority) per campaign.
-- Nếu campaign có nhiều CampaignNiche với rules khác nhau, hậu xét — admin có thể sửa sau.
UPDATE "Campaign" c
SET "filterRules" = sub."filterRules"
FROM (
    SELECT DISTINCT ON ("campaignId") "campaignId", "filterRules"
    FROM "CampaignNiche"
    ORDER BY "campaignId", "priority" ASC, "createdAt" ASC
) sub
WHERE c.id = sub."campaignId" AND c."filterRules" IS NULL;
