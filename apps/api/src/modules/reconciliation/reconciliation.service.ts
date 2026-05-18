import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AccesstradeClient,
  AccesstradeOrder
} from "../crawler/clients/accesstrade.client";

export interface ReconcileResult {
  fetched: number;
  matched: number;
  updated: number;
  unmatched: number;
}

export const RECONCILE_OVERLAP_MS = 10 * 60 * 1000;
export const RECONCILE_FIRST_RUN_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RECONCILE_PAGE_LIMIT = 300;
export const RECONCILE_PAGE_SLEEP_MS = 7000;
export const RECONCILE_PAGE_CAP = 20;

const REVENUE_DELTA_THRESHOLD = 1;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  async runReconcileCycle(triggeredBy: "cron" | "manual" = "cron"): Promise<ReconcileResult> {
    const lastLog = await this.prisma.reconciliationLog.findFirst({
      where: { success: true },
      orderBy: { startedAt: "desc" }
    });
    const since = lastLog
      ? new Date(lastLog.syncWindowEnd.getTime() - RECONCILE_OVERLAP_MS)
      : new Date(Date.now() - RECONCILE_FIRST_RUN_WINDOW_MS);
    const until = new Date();

    const log = await this.prisma.reconciliationLog.create({
      data: {
        triggeredBy,
        syncWindowStart: since,
        syncWindowEnd: until
      }
    });
    const start = Date.now();

    try {
      const orders = await this.fetchAllOrders(since, until);
      let matched = 0;
      let updated = 0;
      let unmatched = 0;

      for (const order of orders) {
        let webhook = null;
        if (order.utm_source) {
          webhook = await this.prisma.conversionWebhook.findFirst({
            where: { trackingCode: order.utm_source }
          });
        }
        if (!webhook) {
          webhook = await this.prisma.conversionWebhook.findFirst({
            where: { atOrderId: order.order_id }
          });
        }

        if (!webhook) {
          unmatched += 1;
          this.logger.warn(
            `Reconcile: order ${order.order_id} (utm_source=${order.utm_source ?? "null"}) không match webhook nào — webhook có thể miss`
          );
          continue;
        }

        matched += 1;

        const newStatus = this.computeStatus(order);
        const webhookRevenue = Number(webhook.revenue);
        const atCommission = Number(order.pub_commission);
        let note: string | null = null;
        if (Math.abs(webhookRevenue - atCommission) > REVENUE_DELTA_THRESHOLD) {
          const delta = (webhookRevenue - atCommission).toFixed(2);
          note = `webhook revenue=${webhookRevenue}, AT pub_commission=${atCommission} (delta=${delta})`;
        }

        const nextSource =
          webhook.source === "webhook" || webhook.source === "both" ? "both" : "api-reconcile";

        await this.prisma.conversionWebhook.update({
          where: { id: webhook.id },
          data: {
            atOrderId: order.order_id,
            atCommission: new Prisma.Decimal(order.pub_commission),
            status: newStatus,
            source: nextSource,
            lastReconciledAt: new Date(),
            reconcileNotes: note,
            payload: {
              ...((webhook.payload as Prisma.JsonObject | null) ?? {}),
              atOrder: order as unknown as Prisma.JsonValue
            } as Prisma.InputJsonValue
          }
        });
        updated += 1;
      }

      await this.prisma.reconciliationLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          fetched: orders.length,
          matched,
          updated,
          unmatched,
          success: true,
          durationMs: Date.now() - start
        }
      });

      this.logger.log(
        `Reconcile: ${orders.length} fetched, ${matched} matched, ${updated} updated, ${unmatched} unmatched`
      );
      return { fetched: orders.length, matched, updated, unmatched };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.reconciliationLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          success: false,
          errorReason: message.slice(0, 1000),
          durationMs: Date.now() - start
        }
      });
      throw error;
    }
  }

  private computeStatus(order: AccesstradeOrder): string {
    if (order.order_approved > 0 && order.order_pending === 0 && order.order_reject === 0) {
      return "approved";
    }
    if (order.order_reject > 0 && order.order_approved === 0) {
      return "rejected";
    }
    return "pending";
  }

  private async fetchAllOrders(since: Date, until: Date): Promise<AccesstradeOrder[]> {
    const all: AccesstradeOrder[] = [];
    let page = 1;
    while (page <= RECONCILE_PAGE_CAP) {
      const batch = await this.accesstrade.fetchOrders({
        since,
        until,
        page,
        limit: RECONCILE_PAGE_LIMIT
      });
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < RECONCILE_PAGE_LIMIT) break;
      page += 1;
      await this.sleep(RECONCILE_PAGE_SLEEP_MS);
    }
    return all;
  }

  // Exposed seam for testing rate-limit sleep without faking globalThis.setTimeout.
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
