import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ReconciliationService } from "./reconciliation.service";

@Injectable()
export class ReconciliationScheduler {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  constructor(private readonly reconciler: ReconciliationService) {}

  @Cron(process.env.RECONCILE_CRON ?? CronExpression.EVERY_30_MINUTES, {
    name: "reconciliation-cycle"
  })
  async handleCron(): Promise<void> {
    if (process.env.RECONCILE_ENABLED === "false") {
      this.logger.debug("Reconciliation disabled via env");
      return;
    }
    try {
      await this.reconciler.runReconcileCycle("cron");
    } catch (error: unknown) {
      this.logger.error(
        "Reconciliation cycle failed",
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
