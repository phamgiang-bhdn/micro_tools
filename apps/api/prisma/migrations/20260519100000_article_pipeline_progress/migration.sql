-- Article V2 pipeline: progress reporting, attribution, loop-back semantics.
ALTER TABLE "Article"
  ADD COLUMN "aiRevisionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "thesisEmbedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
  ADD COLUMN "coverImageAttribution" JSONB,
  ADD COLUMN "currentStageMessage" TEXT,
  ADD COLUMN "currentStageProgress" INTEGER;

ALTER TABLE "ArticleGenerationRun"
  ADD COLUMN "output" JSONB;
