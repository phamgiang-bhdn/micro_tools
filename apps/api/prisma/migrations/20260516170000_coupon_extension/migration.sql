-- AlterTable: Coupon — thêm field AT sync
ALTER TABLE "Coupon"
  ADD COLUMN "campaignId" UUID,
  ADD COLUMN "atCouponId" TEXT,
  ADD COLUMN "merchantSlug" TEXT,
  ADD COLUMN "merchantDisplay" TEXT,
  ADD COLUMN "merchantLogo" TEXT,
  ADD COLUMN "iconText" TEXT,
  ADD COLUMN "iconTextId" TEXT,
  ADD COLUMN "contentHtml" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "bannersJson" JSONB,
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "prodLink" TEXT,
  ADD COLUMN "coinCap" DECIMAL(15,2),
  ADD COLUMN "coinPercentage" DECIMAL(5,2),
  ADD COLUMN "percentageUsed" DECIMAL(5,2),
  ADD COLUMN "atRawData" JSONB,
  ADD COLUMN "atLastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Coupon_atCouponId_key" ON "Coupon" ("atCouponId");
CREATE INDEX "Coupon_merchantSlug_isActive_idx" ON "Coupon" ("merchantSlug", "isActive");
CREATE INDEX "Coupon_atLastSyncedAt_idx" ON "Coupon" ("atLastSyncedAt");
CREATE INDEX "Coupon_campaignId_idx" ON "Coupon" ("campaignId");

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
