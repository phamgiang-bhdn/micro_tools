-- Rename `Category` → `Niche` (presentation/SEO entity). KHÔNG đổi data, chỉ rename schema objects.
-- Sau PR này sẽ có model `Category` mới (PR2) làm AT taxonomy.

-- ============================================================
-- 1. Enum rename
-- ============================================================
ALTER TYPE "CategoryStatus" RENAME TO "NicheStatus";

-- ============================================================
-- 2. Table rename: Category → Niche
-- ============================================================
ALTER TABLE "Category" RENAME TO "Niche";
ALTER TABLE "Niche" RENAME CONSTRAINT "Category_pkey" TO "Niche_pkey";
ALTER INDEX "Category_slug_key" RENAME TO "Niche_slug_key";

-- ============================================================
-- 3. Column rename: Product.categoryId → nicheId
-- ============================================================
ALTER TABLE "Product" RENAME COLUMN "categoryId" TO "nicheId";
ALTER TABLE "Product" RENAME CONSTRAINT "Product_categoryId_fkey" TO "Product_nicheId_fkey";
ALTER INDEX "Product_categoryId_idx" RENAME TO "Product_nicheId_idx";
ALTER INDEX "Product_categoryId_slug_key" RENAME TO "Product_nicheId_slug_key";

-- ============================================================
-- 4. Column rename: Coupon.categoryId → nicheId
-- ============================================================
ALTER TABLE "Coupon" RENAME COLUMN "categoryId" TO "nicheId";
ALTER TABLE "Coupon" RENAME CONSTRAINT "Coupon_categoryId_fkey" TO "Coupon_nicheId_fkey";
ALTER INDEX "Coupon_categoryId_isActive_idx" RENAME TO "Coupon_nicheId_isActive_idx";

-- ============================================================
-- 5. Column rename: Article.categoryId → nicheId
-- ============================================================
ALTER TABLE "Article" RENAME COLUMN "categoryId" TO "nicheId";
ALTER TABLE "Article" RENAME CONSTRAINT "Article_categoryId_fkey" TO "Article_nicheId_fkey";
ALTER INDEX "Article_categoryId_status_idx" RENAME TO "Article_nicheId_status_idx";

-- ============================================================
-- 6. Join table rename: CampaignCategory → CampaignNiche, column categoryId → nicheId
-- ============================================================
ALTER TABLE "CampaignCategory" RENAME TO "CampaignNiche";
ALTER TABLE "CampaignNiche" RENAME COLUMN "categoryId" TO "nicheId";
ALTER TABLE "CampaignNiche" RENAME CONSTRAINT "CampaignCategory_pkey" TO "CampaignNiche_pkey";
ALTER TABLE "CampaignNiche" RENAME CONSTRAINT "CampaignCategory_campaignId_fkey" TO "CampaignNiche_campaignId_fkey";
ALTER TABLE "CampaignNiche" RENAME CONSTRAINT "CampaignCategory_categoryId_fkey" TO "CampaignNiche_nicheId_fkey";
ALTER INDEX "CampaignCategory_campaignId_categoryId_key" RENAME TO "CampaignNiche_campaignId_nicheId_key";
ALTER INDEX "CampaignCategory_campaignId_priority_idx" RENAME TO "CampaignNiche_campaignId_priority_idx";
ALTER INDEX "CampaignCategory_categoryId_idx" RENAME TO "CampaignNiche_nicheId_idx";
