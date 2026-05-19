import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CouponSyncService } from "./coupon-sync.service";

@Injectable()
export class CouponSyncScheduler {
  private readonly logger = new Logger(CouponSyncScheduler.name);

  constructor(private readonly couponSync: CouponSyncService) {}

  @Cron("0 */6 * * *", { name: "coupon-sync-cycle" })
  async handleCron(): Promise<void> {
    try {
      await this.couponSync.syncFromAccesstrade();
    } catch (error: unknown) {
      this.logger.error(
        "Coupon sync failed",
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
