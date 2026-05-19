import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { CrawlerService } from "./crawler.service";

/**
 * Cron tick mặc định mỗi 6 tiếng. Đổi qua env CRAWLER_CRON (cron expression).
 * Tắt qua CRAWLER_ENABLED=false.
 *
 * Sau campaign↔niche N:N refactor: cycle chạy per-campaign — chỉ Campaign status=APPROVED + atCampaignId + ≥1
 * assignment (CampaignNiche) mới được pull. Onboard niche mới = sync /v1/campaigns → admin assign 1+ niche
 * trong /admin/campaigns (mỗi cặp có filterRules + priority riêng, first-match-wins).
 */
@Injectable()
export class CrawlerScheduler {
  private readonly logger = new Logger(CrawlerScheduler.name);

  constructor(
    private readonly crawler: CrawlerService,
    private readonly prisma: PrismaService
  ) {}

  @Cron("0 */6 * * *", { name: "crawler-cycle" })
  async tick(): Promise<void> {
    try {
      const r = await this.crawler.runFullCycle("cron");
      this.logger.log(`Tick done: fetched=${r.fetched} created=${r.created} updated=${r.updated}`);
    } catch (error: unknown) {
      this.logger.error("Crawler tick failed", error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Mỗi phút kiểm tra article DRAFT có scheduledAt đã đến — auto-publish.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: "article-scheduler" })
  async publishScheduled(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.article.findMany({
      where: { status: "DRAFT", scheduledAt: { lte: now, not: null } },
      select: { id: true, slug: true }
    });
    if (due.length === 0) return;
    this.logger.log(`Auto-publishing ${due.length} scheduled article(s)`);
    await this.prisma.article.updateMany({
      where: { id: { in: due.map((a) => a.id) } },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        reviewedBy: "scheduler",
        reviewedAt: now
      }
    });
  }
}
