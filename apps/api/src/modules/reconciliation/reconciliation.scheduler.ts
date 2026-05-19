import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ReconciliationService } from "./reconciliation.service";

@Injectable()
export class ReconciliationScheduler {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  constructor(private readonly reconciler: ReconciliationService) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: "reconciliation-cycle" })
  async handleCron(): Promise<void> {
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
