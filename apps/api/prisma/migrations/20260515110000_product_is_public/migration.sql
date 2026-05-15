-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: products with at least one PUBLISHED extraction stay public; products with NONE remain public too (legacy assumption — only discovered-from-AI rows start false).
CREATE INDEX IF NOT EXISTS "Product_isPublic_toolId_idx" ON "Product" ("isPublic", "toolId");
