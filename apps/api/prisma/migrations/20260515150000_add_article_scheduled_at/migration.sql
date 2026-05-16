-- AlterTable: Article.scheduledAt missing in DB but referenced in schema + crawler.scheduler.
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

-- CreateIndex (matches schema's @@index([scheduledAt]))
CREATE INDEX IF NOT EXISTS "Article_scheduledAt_idx" ON "Article"("scheduledAt");
