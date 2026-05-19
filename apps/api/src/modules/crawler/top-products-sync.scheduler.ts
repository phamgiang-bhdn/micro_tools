import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { TopProductsSyncService } from "./top-products-sync.service";

@Injectable()
export class TopProductsSyncScheduler {
  private readonly logger = new Logger(TopProductsSyncScheduler.name);

  constructor(private readonly service: TopProductsSyncService) {}

  @Cron("0 3 * * *", { name: "top-products-sync" })
  async handleCron(): Promise<void> {
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
