-- Add nullable slug column for SEO-friendly URLs (vs raw UUID).
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;

-- Slugs must be unique per tool (different tools can share a slug).
-- Multiple NULL values are allowed by Postgres semantics — fine for legacy rows.
CREATE UNIQUE INDEX "Product_toolId_slug_key" ON "Product"("toolId", "slug");
