-- CreateEnum
CREATE TYPE "NicheStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('DRAFT_RAW', 'PENDING_REVIEW', 'PUBLISHED', 'ERROR');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('BUYING_GUIDE', 'REVIEW');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('GENERATING', 'DRAFT', 'DRAFT_BRIEF', 'RESEARCHING', 'REVIEWS_SCRAPED', 'OUTLINE_READY', 'IMAGES_READY', 'DRAFTING', 'SELF_CRITIQUED', 'FACT_CHECKED', 'PENDING_REVIEW', 'NEEDS_REVISION', 'PUBLISHED', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('FACT', 'REVIEW', 'PRICE', 'SPEC', 'IMAGE', 'NEWS');

-- CreateEnum
CREATE TYPE "AffiliateNetwork" AS ENUM ('ACCESSTRADE', 'SHOPEE', 'TIKTOK', 'LAZADA');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('APPLIED', 'APPROVED', 'REJECTED', 'PAUSED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
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

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "network" "AffiliateNetwork" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "commissionNote" TEXT,
    "notes" TEXT,
    "atCampaignId" TEXT,
    "atCategoryName" TEXT,
    "atSubCategory" TEXT,
    "atLogo" TEXT,
    "atMerchantUrl" TEXT,
    "atScope" TEXT,
    "atCookieDurationSec" INTEGER,
    "atStartTime" TIMESTAMP(3),
    "atEndTime" TIMESTAMP(3),
    "atRawData" JSONB,
    "atLastSyncedAt" TIMESTAMP(3),
    "filterRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountPercent" INTEGER,
    "discountAmount" DECIMAL(10,2),
    "network" "AffiliateNetwork",
    "productId" UUID,
    "nicheId" UUID,
    "campaignId" UUID,
    "affiliateUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "atCouponId" TEXT,
    "merchantSlug" TEXT,
    "merchantDisplay" TEXT,
    "merchantLogo" TEXT,
    "iconText" TEXT,
    "iconTextId" TEXT,
    "contentHtml" TEXT,
    "imageUrl" TEXT,
    "bannersJson" JSONB,
    "domain" TEXT,
    "prodLink" TEXT,
    "coinCap" DECIMAL(15,2),
    "coinPercentage" DECIMAL(5,2),
    "percentageUsed" DECIMAL(5,2),
    "atRawData" JSONB,
    "atLastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niche" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "NicheStatus" NOT NULL DEFAULT 'ACTIVE',
    "schemaConfig" JSONB NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "nicheId" UUID,
    "shopId" UUID,
    "network" "AffiliateNetwork" NOT NULL DEFAULT 'ACCESSTRADE',
    "campaignId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "affiliateUrl" TEXT NOT NULL,
    "scrapedData" JSONB NOT NULL,
    "priceIntel" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickLog" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "channel" TEXT DEFAULT 'direct',
    "subId1" TEXT,
    "subId2" TEXT,
    "attributionSource" TEXT,
    "hasInlineCoupon" BOOLEAN NOT NULL DEFAULT false,
    "toolId" UUID,
    "quizSessionId" UUID,
    "marketplace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionWebhook" (
    "id" UUID NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "network" "AffiliateNetwork" NOT NULL DEFAULT 'ACCESSTRADE',
    "campaignId" UUID,
    "revenue" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT DEFAULT 'webhook',
    "lastReconciledAt" TIMESTAMP(3),
    "atOrderId" TEXT,
    "atCommission" DECIMAL(10,2),
    "reconcileNotes" TEXT,
    "channel" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopProductSnapshot" (
    "id" UUID NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL,
    "atProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "image" TEXT,
    "link" TEXT NOT NULL,
    "affLink" TEXT NOT NULL,
    "categoryName" TEXT,
    "productCategory" TEXT,
    "price" DECIMAL(15,2),
    "discount" DECIMAL(15,2),
    "merchant" TEXT,
    "shortDesc" TEXT,
    "atRawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopProductSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationLog" (
    "id" UUID NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "syncWindowStart" TIMESTAMP(3) NOT NULL,
    "syncWindowEnd" TIMESTAMP(3) NOT NULL,
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unmatched" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorReason" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "ReconciliationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductExtraction" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "rawContent" TEXT NOT NULL,
    "aiOutput" JSONB,
    "status" "ParseStatus" NOT NULL DEFAULT 'DRAFT_RAW',
    "errorReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "confidenceScore" INTEGER,
    "confidenceReasons" JSONB,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "autoApprovedAt" TIMESTAMP(3),
    "unapprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "blocks" JSONB,
    "coverImage" TEXT,
    "type" "ArticleType" NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "nicheId" UUID,
    "productIds" UUID[],
    "pinnedProductIds" UUID[],
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "aiModel" TEXT,
    "aiPromptName" TEXT,
    "generationError" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "briefJson" JSONB,
    "outlineJson" JSONB,
    "authorId" UUID,
    "layoutVariant" TEXT,
    "wordCount" INTEGER,
    "readabilityScore" DOUBLE PRECISION,
    "evidenceFreshAt" TIMESTAMP(3),
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "aiRevisionCount" INTEGER NOT NULL DEFAULT 0,
    "thesisEmbedding" DOUBLE PRECISION[],
    "coverImageAttribution" JSONB,
    "currentStageMessage" TEXT,
    "currentStageProgress" INTEGER,
    "currentStageStartedAt" TIMESTAMP(3),
    "pauseAtOutline" BOOLEAN NOT NULL DEFAULT false,
    "topic" TEXT,
    "productRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

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
    "output" JSONB,
    "durationMs" INTEGER,
    "costEstimate" DECIMAL(10,6),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ArticleGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "pushEndpoint" TEXT,
    "pushP256dh" TEXT,
    "pushAuth" TEXT,
    "zaloUserId" TEXT,
    "source" TEXT NOT NULL,
    "preferredNiches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LastSyncStatus" (
    "name" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastDurationMs" INTEGER,
    "lastResult" JSONB,
    "expectedFrequencySec" INTEGER NOT NULL,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastSyncStatus_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "OrderProduct" (
    "id" UUID NOT NULL,
    "conversionWebhookId" UUID NOT NULL,
    "atOrderProductId" TEXT NOT NULL,
    "atCampaignId" TEXT,
    "merchant" TEXT NOT NULL,
    "atProductId" TEXT,
    "productName" TEXT,
    "productImage" TEXT,
    "productPrice" DOUBLE PRECISION,
    "productQuantity" INTEGER,
    "approvedQuantity" INTEGER NOT NULL DEFAULT 0,
    "pendingQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectQuantity" INTEGER NOT NULL DEFAULT 0,
    "approvedBilling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesTime" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedProductId" UUID,

    CONSTRAINT "OrderProduct_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "originalPrice" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "source" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "subscriberId" UUID NOT NULL,
    "targetPrice" DECIMAL(15,2),
    "notifyOnAnyDrop" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),
    "lastNotifiedPrice" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawlerLog_startedAt_idx" ON "CrawlerLog"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_atCampaignId_key" ON "Campaign"("atCampaignId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_network_status_idx" ON "Campaign"("network", "status");

-- CreateIndex
CREATE INDEX "Campaign_atCampaignId_idx" ON "Campaign"("atCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_network_externalId_key" ON "Campaign"("network", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_atCouponId_key" ON "Coupon"("atCouponId");

-- CreateIndex
CREATE INDEX "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "Coupon_nicheId_isActive_idx" ON "Coupon"("nicheId", "isActive");

-- CreateIndex
CREATE INDEX "Coupon_productId_isActive_idx" ON "Coupon"("productId", "isActive");

-- CreateIndex
CREATE INDEX "Coupon_merchantSlug_isActive_idx" ON "Coupon"("merchantSlug", "isActive");

-- CreateIndex
CREATE INDEX "Coupon_atLastSyncedAt_idx" ON "Coupon"("atLastSyncedAt");

-- CreateIndex
CREATE INDEX "Coupon_campaignId_idx" ON "Coupon"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Niche_slug_key" ON "Niche"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE INDEX "Product_nicheId_idx" ON "Product"("nicheId");

-- CreateIndex
CREATE INDEX "Product_campaignId_idx" ON "Product"("campaignId");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_nicheId_slug_key" ON "Product"("nicheId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClickLog_trackingCode_key" ON "ClickLog"("trackingCode");

-- CreateIndex
CREATE INDEX "ClickLog_productId_createdAt_idx" ON "ClickLog"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickLog_channel_idx" ON "ClickLog"("channel");

-- CreateIndex
CREATE INDEX "ClickLog_createdAt_channel_idx" ON "ClickLog"("createdAt", "channel");

-- CreateIndex
CREATE INDEX "ClickLog_toolId_createdAt_idx" ON "ClickLog"("toolId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickLog_quizSessionId_idx" ON "ClickLog"("quizSessionId");

-- CreateIndex
CREATE INDEX "ConversionWebhook_trackingCode_receivedAt_idx" ON "ConversionWebhook"("trackingCode", "receivedAt");

-- CreateIndex
CREATE INDEX "ConversionWebhook_network_receivedAt_idx" ON "ConversionWebhook"("network", "receivedAt");

-- CreateIndex
CREATE INDEX "ConversionWebhook_campaignId_receivedAt_idx" ON "ConversionWebhook"("campaignId", "receivedAt");

-- CreateIndex
CREATE INDEX "ConversionWebhook_atOrderId_idx" ON "ConversionWebhook"("atOrderId");

-- CreateIndex
CREATE INDEX "ConversionWebhook_lastReconciledAt_idx" ON "ConversionWebhook"("lastReconciledAt");

-- CreateIndex
CREATE INDEX "ConversionWebhook_channel_idx" ON "ConversionWebhook"("channel");

-- CreateIndex
CREATE INDEX "ConversionWebhook_receivedAt_channel_idx" ON "ConversionWebhook"("receivedAt", "channel");

-- CreateIndex
CREATE INDEX "TopProductSnapshot_snapshotDate_idx" ON "TopProductSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "TopProductSnapshot_merchant_snapshotDate_idx" ON "TopProductSnapshot"("merchant", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "TopProductSnapshot_snapshotDate_position_atProductId_key" ON "TopProductSnapshot"("snapshotDate", "position", "atProductId");

-- CreateIndex
CREATE INDEX "ReconciliationLog_startedAt_idx" ON "ReconciliationLog"("startedAt");

-- CreateIndex
CREATE INDEX "ProductExtraction_productId_status_createdAt_idx" ON "ProductExtraction"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductExtraction_confidenceScore_idx" ON "ProductExtraction"("confidenceScore");

-- CreateIndex
CREATE INDEX "ProductExtraction_autoApproved_idx" ON "ProductExtraction"("autoApproved");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_name_key" ON "PromptTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_nicheId_status_idx" ON "Article"("nicheId", "status");

-- CreateIndex
CREATE INDEX "Article_type_status_idx" ON "Article"("type", "status");

-- CreateIndex
CREATE INDEX "Article_scheduledAt_idx" ON "Article"("scheduledAt");

-- CreateIndex
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");

-- CreateIndex
CREATE INDEX "Article_evidenceFreshAt_idx" ON "Article"("evidenceFreshAt");

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
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_pushEndpoint_key" ON "Subscriber"("pushEndpoint");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_zaloUserId_key" ON "Subscriber"("zaloUserId");

-- CreateIndex
CREATE INDEX "Subscriber_source_idx" ON "Subscriber"("source");

-- CreateIndex
CREATE INDEX "Subscriber_status_idx" ON "Subscriber"("status");

-- CreateIndex
CREATE INDEX "LastSyncStatus_isStale_idx" ON "LastSyncStatus"("isStale");

-- CreateIndex
CREATE INDEX "OrderProduct_matchedProductId_idx" ON "OrderProduct"("matchedProductId");

-- CreateIndex
CREATE INDEX "OrderProduct_salesTime_idx" ON "OrderProduct"("salesTime");

-- CreateIndex
CREATE UNIQUE INDEX "OrderProduct_conversionWebhookId_atOrderProductId_key" ON "OrderProduct"("conversionWebhookId", "atOrderProductId");

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
CREATE INDEX "ReasoningCache_productId_idx" ON "ReasoningCache"("productId");

-- CreateIndex
CREATE INDEX "ReasoningCache_createdAt_idx" ON "ReasoningCache"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReasoningCache_productId_profileHash_model_key" ON "ReasoningCache"("productId", "profileHash", "model");

-- CreateIndex
CREATE INDEX "PriceSnapshot_productId_capturedAt_idx" ON "PriceSnapshot"("productId", "capturedAt");

-- CreateIndex
CREATE INDEX "PriceSnapshot_capturedAt_idx" ON "PriceSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "PriceAlert_productId_isActive_idx" ON "PriceAlert"("productId", "isActive");

-- CreateIndex
CREATE INDEX "PriceAlert_subscriberId_idx" ON "PriceAlert"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_productId_subscriberId_key" ON "PriceAlert"("productId", "subscriberId");

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickLog" ADD CONSTRAINT "ClickLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickLog" ADD CONSTRAINT "ClickLog_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickLog" ADD CONSTRAINT "ClickLog_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "QuizSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionWebhook" ADD CONSTRAINT "ConversionWebhook_trackingCode_fkey" FOREIGN KEY ("trackingCode") REFERENCES "ClickLog"("trackingCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionWebhook" ADD CONSTRAINT "ConversionWebhook_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExtraction" ADD CONSTRAINT "ProductExtraction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_conversionWebhookId_fkey" FOREIGN KEY ("conversionWebhookId") REFERENCES "ConversionWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistSignup" ADD CONSTRAINT "WaitlistSignup_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

