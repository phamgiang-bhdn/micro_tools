-- Cleanup legacy drift remaining after Tool→Category rename + ad-hoc schema edits.
-- All 3 changes are cosmetic at query time but cause `prisma migrate diff` to flag drift.

-- 1. Stale index referencing dropped Product.toolId column (legacy from Tool model).
DROP INDEX IF EXISTS "Product_isPublic_toolId_idx";

-- 2. Schema declares Article.pinnedProductIds without default; DB had inherited default.
ALTER TABLE "Article" ALTER COLUMN "pinnedProductIds" DROP DEFAULT;

-- 3. Schema declares Product.network @default(ACCESSTRADE); DB column lost the default.
ALTER TABLE "Product" ALTER COLUMN "network" SET DEFAULT 'ACCESSTRADE';
