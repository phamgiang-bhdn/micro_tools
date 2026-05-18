-- PR3: Add Source (nơi bán) + Brand (thương hiệu) lookup tables.
-- Replace Product.domain (PR2 raw string) bằng Product.sourceId FK.
-- Add Product.brandId FK.

CREATE TABLE "Source" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "displayName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'accesstrade',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Source_slug_key" ON "Source"("slug");

CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "displayName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'accesstrade',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- Drop PR2's raw Product.domain (replaced by sourceId FK).
DROP INDEX "Product_domain_idx";
ALTER TABLE "Product" DROP COLUMN "domain";

ALTER TABLE "Product"
    ADD COLUMN "sourceId" UUID,
    ADD COLUMN "brandId" UUID;

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Product_sourceId_idx" ON "Product"("sourceId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
