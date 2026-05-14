import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CrawlerService } from "./crawler.service";

/**
 * Cron tick mặc định mỗi 6 tiếng. Đổi qua env CRAWLER_CRON (cron expression).
 * Tắt qua CRAWLER_ENABLED=false.
 */
@Injectable()
export class CrawlerScheduler {
  private readonly logger = new Logger(CrawlerScheduler.name);

  constructor(private readonly crawler: CrawlerService) {}

  @Cron(process.env.CRAWLER_CRON ?? "0 */6 * * *", { name: "crawler-cycle" })
  async tick(): Promise<void> {
    if (process.env.CRAWLER_ENABLED === "false") {
      this.logger.log("Crawler disabled — skipping tick");
      return;
    }
    try {
      const r = await this.crawler.runFullCycle();
      this.logger.log(`Tick done: fetched=${r.fetched} created=${r.created} updated=${r.updated}`);
    } catch (error: unknown) {
      this.logger.error("Crawler tick failed", error instanceof Error ? error.stack : String(error));
    }
  }
}
