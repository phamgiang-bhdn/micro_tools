import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { TopProductsSyncService } from "./top-products-sync.service";

@Injectable()
export class TopProductsSyncScheduler {
  private readonly logger = new Logger(TopProductsSyncScheduler.name);

  constructor(private readonly service: TopProductsSyncService) {}

  @Cron(process.env.TOP_PRODUCTS_CRON ?? "0 3 * * *", { name: "top-products-sync" })
  async handleCron(): Promise<void> {
    if (process.env.TOP_PRODUCTS_ENABLED === "false") {
      this.logger.debug("Top products sync disabled via env");
      return;
    }
    try {
      await this.service.syncDailySnapshot();
    } catch (error: unknown) {
      this.logger.error(
        "Top products sync failed",
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
