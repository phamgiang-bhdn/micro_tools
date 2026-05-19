-- Article V2 — live progress + bug fixes round 1.
-- 1) Article: tách aiRevisionCount khỏi revisionCount (counter human takeover cũ); cache
--    thesisEmbedding để tránh N+1 embed call ở Brief Builder; lưu attribution ảnh bìa
--    (Unsplash License yêu cầu credit photographer); 2 field cho progress live UI.
-- 2) ArticleGenerationRun: thêm output JSONB để giữ outputSummary của stage (trước chỉ
--    lưu size, không debug được).

ALTER TABLE "Article"
  ADD COLUMN "aiRevisionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "thesisEmbedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
  ADD COLUMN "coverImageAttribution" JSONB,
  ADD COLUMN "currentStageMessage" TEXT,
  ADD COLUMN "currentStageProgress" INTEGER;

ALTER TABLE "ArticleGenerationRun"
  ADD COLUMN "output" JSONB;
