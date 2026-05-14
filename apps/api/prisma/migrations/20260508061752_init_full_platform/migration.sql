-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('DRAFT_RAW', 'PENDING_REVIEW', 'PUBLISHED', 'ERROR');

-- CreateTable
CREATE TABLE "Tool" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ToolStatus" NOT NULL DEFAULT 'ACTIVE',
    "schemaConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "toolId" UUID NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'ACCESSTRADE',
    "name" TEXT NOT NULL,
    "affiliateUrl" TEXT NOT NULL,
    "scrapedData" JSONB NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionWebhook" (
    "id" UUID NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionWebhook_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "Tool_slug_key" ON "Tool"("slug");

-- CreateIndex
CREATE INDEX "Product_toolId_idx" ON "Product"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "ClickLog_trackingCode_key" ON "ClickLog"("trackingCode");

-- CreateIndex
CREATE INDEX "ClickLog_productId_createdAt_idx" ON "ClickLog"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversionWebhook_trackingCode_receivedAt_idx" ON "ConversionWebhook"("trackingCode", "receivedAt");

-- CreateIndex
CREATE INDEX "ProductExtraction_productId_status_createdAt_idx" ON "ProductExtraction"("productId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_name_key" ON "PromptTemplate"("name");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickLog" ADD CONSTRAINT "ClickLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionWebhook" ADD CONSTRAINT "ConversionWebhook_trackingCode_fkey" FOREIGN KEY ("trackingCode") REFERENCES "ClickLog"("trackingCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExtraction" ADD CONSTRAINT "ProductExtraction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
