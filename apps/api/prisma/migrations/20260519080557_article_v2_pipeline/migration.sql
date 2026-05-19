-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('FACT', 'REVIEW', 'PRICE', 'SPEC', 'IMAGE', 'NEWS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ArticleStatus" ADD VALUE 'DRAFT_BRIEF';
ALTER TYPE "ArticleStatus" ADD VALUE 'RESEARCHING';
ALTER TYPE "ArticleStatus" ADD VALUE 'REVIEWS_SCRAPED';
ALTER TYPE "ArticleStatus" ADD VALUE 'OUTLINE_READY';
ALTER TYPE "ArticleStatus" ADD VALUE 'IMAGES_READY';
ALTER TYPE "ArticleStatus" ADD VALUE 'DRAFTING';
ALTER TYPE "ArticleStatus" ADD VALUE 'SELF_CRITIQUED';
ALTER TYPE "ArticleStatus" ADD VALUE 'FACT_CHECKED';
ALTER TYPE "ArticleStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "ArticleStatus" ADD VALUE 'NEEDS_REVISION';

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "authorId" UUID,
ADD COLUMN     "briefJson" JSONB,
ADD COLUMN     "evidenceFreshAt" TIMESTAMP(3),
ADD COLUMN     "layoutVariant" TEXT,
ADD COLUMN     "outlineJson" JSONB,
ADD COLUMN     "productRef" TEXT,
ADD COLUMN     "readabilityScore" DOUBLE PRECISION,
ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "wordCount" INTEGER;

-- CreateTable
CREATE TABLE "Author" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "voiceProfile" JSONB NOT NULL,
    "expertiseNiches" UUID[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleSection" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "anchorSlug" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "intent" TEXT,
    "order" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "blockTypeHints" TEXT[],
    "evidenceRefs" UUID[],
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedWords" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFTING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleEvidence" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "productId" UUID,
    "sourceUrl" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "title" TEXT,
    "payload" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "factCheckPassed" BOOLEAN NOT NULL DEFAULT false,
    "factCheckedAt" TIMESTAMP(3),

    CONSTRAINT "ArticleEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "author" TEXT,
    "rating" DECIMAL(3,2),
    "title" TEXT,
    "body" TEXT NOT NULL,
    "verifiedBuyer" BOOLEAN NOT NULL DEFAULT false,
    "reviewDate" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentiment" TEXT,
    "topicTags" TEXT[],
    "raw" JSONB,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleGenerationRun" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "model" TEXT,
    "promptName" TEXT,
    "inputHash" TEXT,
    "inputSize" INTEGER,
    "outputSize" INTEGER,
    "durationMs" INTEGER,
    "costEstimate" DECIMAL(10,6),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ArticleGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Author_slug_key" ON "Author"("slug");

-- CreateIndex
CREATE INDEX "Author_isActive_idx" ON "Author"("isActive");

-- CreateIndex
CREATE INDEX "ArticleSection_articleId_order_idx" ON "ArticleSection"("articleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSection_articleId_anchorSlug_key" ON "ArticleSection"("articleId", "anchorSlug");

-- CreateIndex
CREATE INDEX "ArticleEvidence_articleId_type_idx" ON "ArticleEvidence"("articleId", "type");

-- CreateIndex
CREATE INDEX "ArticleEvidence_contentHash_idx" ON "ArticleEvidence"("contentHash");

-- CreateIndex
CREATE INDEX "ArticleEvidence_sourceDomain_idx" ON "ArticleEvidence"("sourceDomain");

-- CreateIndex
CREATE INDEX "ArticleEvidence_productId_idx" ON "ArticleEvidence"("productId");

-- CreateIndex
CREATE INDEX "ProductReview_productId_source_idx" ON "ProductReview"("productId", "source");

-- CreateIndex
CREATE INDEX "ProductReview_productId_rating_idx" ON "ProductReview"("productId", "rating");

-- CreateIndex
CREATE INDEX "ProductReview_productId_sentiment_idx" ON "ProductReview"("productId", "sentiment");

-- CreateIndex
CREATE INDEX "ArticleGenerationRun_articleId_startedAt_idx" ON "ArticleGenerationRun"("articleId", "startedAt");

-- CreateIndex
CREATE INDEX "ArticleGenerationRun_stage_success_idx" ON "ArticleGenerationRun"("stage", "success");

-- CreateIndex
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");

-- CreateIndex
CREATE INDEX "Article_evidenceFreshAt_idx" ON "Article"("evidenceFreshAt");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSection" ADD CONSTRAINT "ArticleSection_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleEvidence" ADD CONSTRAINT "ArticleEvidence_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleGenerationRun" ADD CONSTRAINT "ArticleGenerationRun_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
