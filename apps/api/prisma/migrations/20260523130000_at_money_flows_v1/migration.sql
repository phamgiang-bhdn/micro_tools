-- ============================================================================
-- AT Money Flows v1 — Consolidated migration cho 10 stories.
-- Covers: STORY-02 (LastSyncStatus), STORY-04 (CommissionRank/KeywordTrend/
-- KeywordNicheMatch), STORY-05 (OrderProduct + relations), STORY-06 (ClickLog/
-- ConversionWebhook channel + AdSpend), STORY-07 (ClickLog.hasInlineCoupon),
-- STORY-08 (TrackedLink), STORY-09 (ProductExtraction confidence fields).
-- ============================================================================

-- STORY-06 + STORY-07: ClickLog extensions
ALTER TABLE "ClickLog"
  ADD COLUMN "channel"           TEXT DEFAULT 'direct',
  ADD COLUMN "subId1"            TEXT,
  ADD COLUMN "subId2"            TEXT,
  ADD COLUMN "attributionSource" TEXT,
  ADD COLUMN "hasInlineCoupon"   BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ClickLog_channel_idx"            ON "ClickLog"("channel");
CREATE INDEX "ClickLog_createdAt_channel_idx"  ON "ClickLog"("createdAt", "channel");

-- STORY-06: ConversionWebhook channel field + indexes
ALTER TABLE "ConversionWebhook"
  ADD COLUMN "channel" TEXT;

CREATE INDEX "ConversionWebhook_channel_idx"             ON "ConversionWebhook"("channel");
CREATE INDEX "ConversionWebhook_receivedAt_channel_idx"  ON "ConversionWebhook"("receivedAt", "channel");

-- STORY-09: ProductExtraction confidence fields
ALTER TABLE "ProductExtraction"
  ADD COLUMN "confidenceScore"   INTEGER,
  ADD COLUMN "confidenceReasons" JSONB,
  ADD COLUMN "autoApproved"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoApprovedAt"    TIMESTAMP(3),
  ADD COLUMN "unapprovedAt"      TIMESTAMP(3);

CREATE INDEX "ProductExtraction_confidenceScore_idx" ON "ProductExtraction"("confidenceScore");
CREATE INDEX "ProductExtraction_autoApproved_idx"    ON "ProductExtraction"("autoApproved");

-- STORY-02: LastSyncStatus (manual sync tracking)
CREATE TABLE "LastSyncStatus" (
  "name"                  TEXT NOT NULL,
  "lastRunAt"             TIMESTAMP(3),
  "lastSuccessAt"         TIMESTAMP(3),
  "lastError"             TEXT,
  "lastDurationMs"        INTEGER,
  "lastResult"            JSONB,
  "expectedFrequencySec"  INTEGER NOT NULL,
  "isStale"               BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LastSyncStatus_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "LastSyncStatus_isStale_idx" ON "LastSyncStatus"("isStale");

-- Seed 6 row (4 backbone + 2 money loop sync). Idempotent — skip if existed.
INSERT INTO "LastSyncStatus" ("name", "expectedFrequencySec", "updatedAt") VALUES
  ('crawler',         21600, NOW()),
  ('reconcile',        1800, NOW()),
  ('coupon',          21600, NOW()),
  ('top_products',    86400, NOW()),
  ('commission_rank', 604800, NOW()),
  ('keyword_radar',   604800, NOW())
ON CONFLICT ("name") DO NOTHING;

-- STORY-04: CommissionRank
CREATE TABLE "CommissionRank" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "atCampaignId"       TEXT NOT NULL,
  "campaignName"       TEXT NOT NULL,
  "merchant"           TEXT NOT NULL,
  "atCategoryName"     TEXT,
  "atSubCategoryName"  TEXT,
  "minCommission"      DOUBLE PRECISION NOT NULL,
  "maxCommission"      DOUBLE PRECISION NOT NULL,
  "commissionType"     TEXT NOT NULL,
  "allCommissions"     JSONB NOT NULL,
  "fetchedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "syncBatchId"        TEXT NOT NULL,
  CONSTRAINT "CommissionRank_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionRank_syncBatchId_idx"    ON "CommissionRank"("syncBatchId");
CREATE INDEX "CommissionRank_maxCommission_idx"  ON "CommissionRank"("maxCommission");
CREATE INDEX "CommissionRank_atCampaignId_idx"   ON "CommissionRank"("atCampaignId");

-- STORY-04: KeywordTrend
CREATE TABLE "KeywordTrend" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "atKeywordId"  TEXT NOT NULL,
  "iconText"     TEXT NOT NULL,
  "merchant"     TEXT NOT NULL,
  "totalOffer"   INTEGER NOT NULL,
  "fetchedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "syncBatchId"  TEXT NOT NULL,
  CONSTRAINT "KeywordTrend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KeywordTrend_atKeywordId_key" ON "KeywordTrend"("atKeywordId");
CREATE INDEX "KeywordTrend_syncBatchId_idx"        ON "KeywordTrend"("syncBatchId");
CREATE INDEX "KeywordTrend_totalOffer_idx"         ON "KeywordTrend"("totalOffer");

-- STORY-04: KeywordNicheMatch
CREATE TABLE "KeywordNicheMatch" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "keywordTrendId"  UUID NOT NULL,
  "nicheId"         UUID,
  "matchScore"      DOUBLE PRECISION NOT NULL,
  "matchReason"     TEXT,
  CONSTRAINT "KeywordNicheMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KeywordNicheMatch_nicheId_idx"        ON "KeywordNicheMatch"("nicheId");
CREATE INDEX "KeywordNicheMatch_keywordTrendId_idx" ON "KeywordNicheMatch"("keywordTrendId");

ALTER TABLE "KeywordNicheMatch"
  ADD CONSTRAINT "KeywordNicheMatch_keywordTrendId_fkey"
  FOREIGN KEY ("keywordTrendId") REFERENCES "KeywordTrend"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KeywordNicheMatch"
  ADD CONSTRAINT "KeywordNicheMatch_nicheId_fkey"
  FOREIGN KEY ("nicheId") REFERENCES "Niche"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- STORY-05: OrderProduct
CREATE TABLE "OrderProduct" (
  "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversionWebhookId"   UUID NOT NULL,
  "atOrderProductId"      TEXT NOT NULL,
  "atCampaignId"          TEXT,
  "merchant"              TEXT NOT NULL,
  "atProductId"           TEXT,
  "productName"           TEXT,
  "productImage"          TEXT,
  "productPrice"          DOUBLE PRECISION,
  "productQuantity"       INTEGER,
  "approvedQuantity"      INTEGER NOT NULL DEFAULT 0,
  "pendingQuantity"       INTEGER NOT NULL DEFAULT 0,
  "rejectQuantity"        INTEGER NOT NULL DEFAULT 0,
  "approvedBilling"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "approvedCommission"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salesTime"             TIMESTAMP(3),
  "fetchedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "matchedProductId"      UUID,
  CONSTRAINT "OrderProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderProduct_conversionWebhookId_atOrderProductId_key"
  ON "OrderProduct"("conversionWebhookId", "atOrderProductId");
CREATE INDEX "OrderProduct_matchedProductId_idx" ON "OrderProduct"("matchedProductId");
CREATE INDEX "OrderProduct_salesTime_idx"        ON "OrderProduct"("salesTime");

ALTER TABLE "OrderProduct"
  ADD CONSTRAINT "OrderProduct_conversionWebhookId_fkey"
  FOREIGN KEY ("conversionWebhookId") REFERENCES "ConversionWebhook"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderProduct"
  ADD CONSTRAINT "OrderProduct_matchedProductId_fkey"
  FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- STORY-06: AdSpend
CREATE TABLE "AdSpend" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "channel"        TEXT NOT NULL,
  "weekStartDate"  DATE NOT NULL,
  "amount"         INTEGER NOT NULL,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdSpend_channel_weekStartDate_key" ON "AdSpend"("channel", "weekStartDate");
CREATE INDEX "AdSpend_weekStartDate_idx"                ON "AdSpend"("weekStartDate");

-- STORY-08: TrackedLink
CREATE TABLE "TrackedLink" (
  "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
  "title"             TEXT NOT NULL,
  "originUrl"         TEXT NOT NULL,
  "atCampaignId"      TEXT NOT NULL,
  "atAffLink"         TEXT NOT NULL,
  "atShortLink"       TEXT NOT NULL,
  "channel"           TEXT NOT NULL,
  "sub1"              TEXT,
  "sub2"              TEXT,
  "sub3"              TEXT,
  "sub4"              TEXT,
  "utmSource"         TEXT,
  "utmMedium"         TEXT,
  "utmCampaign"       TEXT,
  "utmContent"        TEXT,
  "notes"             TEXT,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"         TEXT,
  "clickCount"        INTEGER NOT NULL DEFAULT 0,
  "conversionCount"   INTEGER NOT NULL DEFAULT 0,
  "revenue"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastConversionAt"  TIMESTAMP(3),
  CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrackedLink_channel_idx"      ON "TrackedLink"("channel");
CREATE INDEX "TrackedLink_createdAt_idx"    ON "TrackedLink"("createdAt");
CREATE INDEX "TrackedLink_atCampaignId_idx" ON "TrackedLink"("atCampaignId");
