-- CreateEnum (only if not exists)
DO $$ BEGIN
  CREATE TYPE "AffiliateNetwork" AS ENUM ('ACCESSTRADE', 'SHOPEE', 'TIKTOK', 'LAZADA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Convert Product.network from text to enum in-place (data preserved via cast).
-- Must drop DEFAULT first because Postgres can't cast it automatically.
ALTER TABLE "Product" ALTER COLUMN "network" DROP DEFAULT;
ALTER TABLE "Product"
  ALTER COLUMN "network" TYPE "AffiliateNetwork"
  USING "network"::text::"AffiliateNetwork";

-- AlterTable Category — add SEO fields
ALTER TABLE "Category" ADD COLUMN     "seoTitle" TEXT,
                      ADD COLUMN     "seoDescription" TEXT;

-- CreateTable CrawlerLog
CREATE TABLE "CrawlerLog" (
    "id" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "passedFilter" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorReason" TEXT,
    "durationMs" INTEGER,
    "triggeredBy" TEXT,

    CONSTRAINT "CrawlerLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrawlerLog_startedAt_idx" ON "CrawlerLog"("startedAt");

-- CreateTable Coupon
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountPercent" INTEGER,
    "discountAmount" DECIMAL(10,2),
    "network" "AffiliateNetwork",
    "productId" UUID,
    "categoryId" UUID,
    "affiliateUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");
CREATE INDEX "Coupon_categoryId_isActive_idx" ON "Coupon"("categoryId", "isActive");
CREATE INDEX "Coupon_productId_isActive_idx" ON "Coupon"("productId", "isActive");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
