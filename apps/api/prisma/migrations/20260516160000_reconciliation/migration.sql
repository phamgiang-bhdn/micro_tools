-- AlterTable: ConversionWebhook — thêm field reconciliation
ALTER TABLE "ConversionWebhook"
  ADD COLUMN "source" TEXT DEFAULT 'webhook',
  ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
  ADD COLUMN "atOrderId" TEXT,
  ADD COLUMN "atCommission" DECIMAL(10,2),
  ADD COLUMN "reconcileNotes" TEXT;

CREATE INDEX "ConversionWebhook_atOrderId_idx" ON "ConversionWebhook" ("atOrderId");
CREATE INDEX "ConversionWebhook_lastReconciledAt_idx" ON "ConversionWebhook" ("lastReconciledAt");

-- CreateTable: ReconciliationLog
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

CREATE INDEX "ReconciliationLog_startedAt_idx" ON "ReconciliationLog" ("startedAt");
