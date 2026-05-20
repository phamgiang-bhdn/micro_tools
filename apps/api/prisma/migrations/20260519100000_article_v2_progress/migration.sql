-- No-op: duplicate of 20260519100000_article_pipeline_progress (git merge collision).
-- Both folders are recorded in _prisma_migrations on the live DB; deleting the folder would
-- break drift detection. Keeping the folder + empty SQL so shadow-DB replay doesn't try to
-- add already-existing columns. Do not delete this file.
SELECT 1;
