/*
  Warnings:

  - You are about to drop the `AdSpend` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommissionRank` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KeywordNicheMatch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KeywordTrend` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PriceWatch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ToolEmailDrip` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrackedLink` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "KeywordNicheMatch" DROP CONSTRAINT "KeywordNicheMatch_keywordTrendId_fkey";

-- DropForeignKey
ALTER TABLE "KeywordNicheMatch" DROP CONSTRAINT "KeywordNicheMatch_nicheId_fkey";

-- DropForeignKey
ALTER TABLE "PriceWatch" DROP CONSTRAINT "PriceWatch_productId_fkey";

-- DropForeignKey
ALTER TABLE "PriceWatch" DROP CONSTRAINT "PriceWatch_subscriberId_fkey";

-- DropTable
DROP TABLE "AdSpend";

-- DropTable
DROP TABLE "CommissionRank";

-- DropTable
DROP TABLE "KeywordNicheMatch";

-- DropTable
DROP TABLE "KeywordTrend";

-- DropTable
DROP TABLE "PriceWatch";

-- DropTable
DROP TABLE "ToolEmailDrip";

-- DropTable
DROP TABLE "TrackedLink";

-- DropEnum
DROP TYPE "EmailDripStatus";
