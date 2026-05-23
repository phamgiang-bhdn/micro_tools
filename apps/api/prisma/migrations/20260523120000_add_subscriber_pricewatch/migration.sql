-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED', 'BOUNCED');

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
CREATE TABLE "PriceWatch" (
    "id" UUID NOT NULL,
    "subscriberId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "notifyDropPercent" INTEGER NOT NULL DEFAULT 5,
    "lastNotifiedAt" TIMESTAMP(3),
    "lastNotifiedPrice" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");
CREATE UNIQUE INDEX "Subscriber_pushEndpoint_key" ON "Subscriber"("pushEndpoint");
CREATE UNIQUE INDEX "Subscriber_zaloUserId_key" ON "Subscriber"("zaloUserId");
CREATE INDEX "Subscriber_source_idx" ON "Subscriber"("source");
CREATE INDEX "Subscriber_status_idx" ON "Subscriber"("status");

CREATE UNIQUE INDEX "PriceWatch_subscriberId_productId_key" ON "PriceWatch"("subscriberId", "productId");
CREATE INDEX "PriceWatch_productId_status_idx" ON "PriceWatch"("productId", "status");

-- AddForeignKey
ALTER TABLE "PriceWatch" ADD CONSTRAINT "PriceWatch_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceWatch" ADD CONSTRAINT "PriceWatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
