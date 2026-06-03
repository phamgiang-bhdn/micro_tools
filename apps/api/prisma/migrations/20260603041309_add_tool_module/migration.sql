-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailDripStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AdSpend" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "thesisEmbedding" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClickLog" ADD COLUMN     "marketplace" TEXT,
ADD COLUMN     "quizSessionId" UUID,
ADD COLUMN     "toolId" UUID;

-- AlterTable
ALTER TABLE "CommissionRank" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KeywordNicheMatch" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KeywordTrend" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrderProduct" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrackedLink" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Tool" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nicheId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tagline" TEXT,
    "quizSchema" JSONB NOT NULL,
    "scoringRules" JSONB NOT NULL,
    "resultTemplate" JSONB NOT NULL,
    "status" "ToolStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" UUID NOT NULL,
    "toolId" UUID NOT NULL,
    "userInput" JSONB NOT NULL,
    "parsedAttributes" JSONB NOT NULL,
    "recommendedProductIds" UUID[],
    "aiReasonings" JSONB,
    "source" TEXT,
    "referrer" TEXT,
    "email" TEXT,
    "shareSlug" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "reasoningMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasoningReadyAt" TIMESTAMP(3),

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistSignup" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nicheId" UUID,
    "nicheSlug" TEXT NOT NULL,
    "surveyAnswer" TEXT,
    "source" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolEmailDrip" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "quizSessionId" UUID,
    "toolId" UUID,
    "productId" UUID,
    "dripType" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "EmailDripStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolEmailDrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReasoningCache" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "profileHash" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReasoningCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tool_slug_key" ON "Tool"("slug");

-- CreateIndex
CREATE INDEX "Tool_nicheId_status_idx" ON "Tool"("nicheId", "status");

-- CreateIndex
CREATE INDEX "Tool_status_idx" ON "Tool"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QuizSession_shareSlug_key" ON "QuizSession"("shareSlug");

-- CreateIndex
CREATE INDEX "QuizSession_toolId_createdAt_idx" ON "QuizSession"("toolId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizSession_source_idx" ON "QuizSession"("source");

-- CreateIndex
CREATE INDEX "QuizSession_email_idx" ON "QuizSession"("email");

-- CreateIndex
CREATE INDEX "WaitlistSignup_nicheSlug_createdAt_idx" ON "WaitlistSignup"("nicheSlug", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistSignup_source_idx" ON "WaitlistSignup"("source");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistSignup_email_nicheSlug_key" ON "WaitlistSignup"("email", "nicheSlug");

-- CreateIndex
CREATE INDEX "ToolEmailDrip_status_scheduledFor_idx" ON "ToolEmailDrip"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ToolEmailDrip_email_idx" ON "ToolEmailDrip"("email");

-- CreateIndex
CREATE INDEX "ToolEmailDrip_quizSessionId_idx" ON "ToolEmailDrip"("quizSessionId");

-- CreateIndex
CREATE INDEX "ToolEmailDrip_dripType_idx" ON "ToolEmailDrip"("dripType");

-- CreateIndex
CREATE INDEX "ReasoningCache_productId_idx" ON "ReasoningCache"("productId");

-- CreateIndex
CREATE INDEX "ReasoningCache_createdAt_idx" ON "ReasoningCache"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReasoningCache_productId_profileHash_model_key" ON "ReasoningCache"("productId", "profileHash", "model");

-- CreateIndex
CREATE INDEX "ClickLog_toolId_createdAt_idx" ON "ClickLog"("toolId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickLog_quizSessionId_idx" ON "ClickLog"("quizSessionId");

-- AddForeignKey
ALTER TABLE "ClickLog" ADD CONSTRAINT "ClickLog_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickLog" ADD CONSTRAINT "ClickLog_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "QuizSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistSignup" ADD CONSTRAINT "WaitlistSignup_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
