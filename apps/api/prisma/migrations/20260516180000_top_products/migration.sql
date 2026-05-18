-- CreateTable: TopProductSnapshot
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

CREATE UNIQUE INDEX "TopProductSnapshot_snapshotDate_position_atProductId_key"
  ON "TopProductSnapshot" ("snapshotDate", "position", "atProductId");
CREATE INDEX "TopProductSnapshot_snapshotDate_idx"
  ON "TopProductSnapshot" ("snapshotDate");
CREATE INDEX "TopProductSnapshot_merchant_snapshotDate_idx"
  ON "TopProductSnapshot" ("merchant", "snapshotDate");
