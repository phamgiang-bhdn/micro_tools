-- PR2: Add AT taxonomy bucket (Category) + Product.categoryId + Product.domain.
-- Category = AT raw taxonomy (auto-upsert từ offer.cate). KHÁC Niche (SEO/curate layer).

CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "displayName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'accesstrade',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

ALTER TABLE "Product"
    ADD COLUMN "categoryId" UUID,
    ADD COLUMN "domain" TEXT;

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_domain_idx" ON "Product"("domain");
