-- Article V2: pause-at-outline gate. Khi true, pipeline halt sau OUTLINE (status=IMAGES_READY)
-- để admin duyệt dàn ý trước khi tốn ~5-10 phút Writer chạy. Admin bấm "Tiếp tục viết bài"
-- → ArticlePipelineService.continuePipeline reset flag + runUntilHitl.
ALTER TABLE "Article" ADD COLUMN "pauseAtOutline" BOOLEAN NOT NULL DEFAULT false;
