-- AlterEnum
ALTER TYPE "ArticleStatus" ADD VALUE 'GENERATING';
ALTER TYPE "ArticleStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Article"
  ADD COLUMN "coverImage" TEXT,
  ADD COLUMN "pinnedProductIds" UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "generationError" TEXT;
