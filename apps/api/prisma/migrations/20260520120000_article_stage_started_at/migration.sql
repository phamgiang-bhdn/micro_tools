-- Article V2 — track stage start time để UI hiển thị elapsed ("đang chạy 1p42s")
-- + cảnh báo treo (> 60s mà progress < 5%). Không cần heartbeat ghi DB lặp.
ALTER TABLE "Article" ADD COLUMN "currentStageStartedAt" TIMESTAMP(3);
