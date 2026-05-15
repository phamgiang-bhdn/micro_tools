-- Rename Tool -> Category across enum, table, foreign keys, indexes, and constraints.
-- This is a pure rename: no data movement. Safe to apply on a populated database.

-- 1. Rename enum
ALTER TYPE "ToolStatus" RENAME TO "CategoryStatus";

-- 2. Rename Tool table -> Category
ALTER TABLE "Tool" RENAME TO "Category";
ALTER TABLE "Category" RENAME CONSTRAINT "Tool_pkey" TO "Category_pkey";
ALTER INDEX "Tool_slug_key" RENAME TO "Category_slug_key";

-- 3. Rename Product.toolId -> Product.categoryId
ALTER TABLE "Product" RENAME COLUMN "toolId" TO "categoryId";
ALTER TABLE "Product" RENAME CONSTRAINT "Product_toolId_fkey" TO "Product_categoryId_fkey";
ALTER INDEX "Product_toolId_idx" RENAME TO "Product_categoryId_idx";
ALTER INDEX "Product_toolId_slug_key" RENAME TO "Product_categoryId_slug_key";

-- 4. Rename Article.toolId -> Article.categoryId
ALTER TABLE "Article" RENAME COLUMN "toolId" TO "categoryId";
ALTER TABLE "Article" RENAME CONSTRAINT "Article_toolId_fkey" TO "Article_categoryId_fkey";
ALTER INDEX "Article_toolId_status_idx" RENAME TO "Article_categoryId_status_idx";

-- 5. Update PromptTemplate prompt placeholders so {toolName} -> {categoryName}
--    in any prompt content rows that exist in the DB.
UPDATE "PromptTemplate"
SET "content" = REPLACE("content", '{toolName}', '{categoryName}')
WHERE "content" LIKE '%{toolName}%';
