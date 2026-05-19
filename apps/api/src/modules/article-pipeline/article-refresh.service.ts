import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ArticleStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ArticlePipelineService } from "./article-pipeline.service";
import { PipelineStageName } from "./pipeline.types";

/**
 * Refresh cron — bài PUBLISHED có evidenceFreshAt > X ngày (mặc định 90).
 * Re-run Research + Fact-Check để kiểm tra evidence còn live + content còn match.
 * Nếu nhiều evidence dead → tạo revision (đặt status NEEDS_REVISION) chờ admin.
 */
@Injectable()
export class ArticleRefreshService {
  private readonly logger = new Logger(ArticleRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: ArticlePipelineService
  ) {}

  @Cron("0 2 * * *", { name: "article-refresh-cycle" })
  async refreshCycle() {
    const FRESHNESS_DAYS = 90;
    const BATCH_SIZE = 5;
    const cutoff = new Date(Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000);

    const stale = await this.prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        OR: [{ evidenceFreshAt: { lt: cutoff } }, { evidenceFreshAt: null }]
      },
      select: { id: true, title: true, evidenceFreshAt: true },
      orderBy: { evidenceFreshAt: "asc" },
      take: BATCH_SIZE
    });

    if (stale.length === 0) {
      this.logger.log("Article refresh: no stale articles");
      return;
    }

    this.logger.log(`Article refresh: checking ${stale.length} stale articles (cutoff ${cutoff.toISOString()})`);

    for (const article of stale) {
      try {
        // Bước 1: re-run RESEARCH để bổ sung evidence mới (replace stale URLs).
        await this.pipeline.retryStage(article.id, PipelineStageName.RESEARCH).catch((e) =>
          this.logger.warn(`Refresh RESEARCH fail for "${article.title}": ${(e as Error).message}`)
        );
        // Bước 2: fact-check để verify lại pass-rate (dead link → NEEDS_REVISION).
        await this.pipeline.retryStage(article.id, PipelineStageName.FACT_CHECK);
        this.logger.log(`Refresh OK for "${article.title}"`);
      } catch (err) {
        this.logger.warn(`Refresh fail for "${article.title}": ${(err as Error).message}`);
      }
    }
  }
}
