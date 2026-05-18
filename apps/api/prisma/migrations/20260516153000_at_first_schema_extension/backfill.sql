-- Manual backfill: chạy SAU khi STORY-02 deploy (sync campaigns từ /v1/campaigns).
-- Đánh dấu campaign cũ (externalId là slug, không phải id số) để admin biết cần re-sync.
-- KHÔNG được Prisma migrate tự chạy — chỉ admin chạy thủ công qua psql/pgAdmin khi sẵn sàng.

UPDATE "Campaign"
SET "notes" = COALESCE("notes", '') || E'\n[legacy] externalId=slug, cần backfill atCampaignId qua /admin/campaigns/sync-from-at'
WHERE "atCampaignId" IS NULL
  AND "externalId" !~ '^[0-9]+$';
