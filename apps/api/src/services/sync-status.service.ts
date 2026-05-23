import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type SyncJobName =
  | "crawler"
  | "reconcile"
  | "coupon"
  | "top_products"
  | "commission_rank"
  | "keyword_radar";

/**
 * Wrap any sync runner để update `LastSyncStatus` row tương ứng.
 * Manual mode (default): cron OFF, operator chạy qua admin button "Đồng bộ tất cả".
 * Mỗi `wrap("<name>", fn)` mark `lastRunAt`, persist `lastResult` JSON khi success,
 * persist `lastError` text khi throw (rethrow để caller xử lý).
 */
@Injectable()
export class SyncStatusService {
  private readonly logger = new Logger(SyncStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  async wrap<T>(name: SyncJobName, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await fn();
      await this.prisma.lastSyncStatus
        .update({
          where: { name },
          data: {
            lastRunAt: new Date(),
            lastSuccessAt: new Date(),
            lastError: null,
            lastDurationMs: Date.now() - startedAt,
            lastResult: (result ?? null) as Prisma.InputJsonValue,
            isStale: false
          }
        })
        .catch((err) => {
          this.logger.warn(
            `[sync-status] cannot update ${name}: ${err instanceof Error ? err.message : String(err)}`
          );
        });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.lastSyncStatus
        .update({
          where: { name },
          data: {
            lastRunAt: new Date(),
            lastError: message.slice(0, 2000),
            lastDurationMs: Date.now() - startedAt
          }
        })
        .catch(() => undefined);
      throw err;
    }
  }
}
