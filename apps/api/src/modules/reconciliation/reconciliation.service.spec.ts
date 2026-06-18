import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SyncStatusService } from "../../services/sync-status.service";
import { AccesstradeClient, AccesstradeOrder } from "../crawler/clients/accesstrade.client";
import { OrderProductsSyncService } from "../insights/order-products-sync.service";
import {
  RECONCILE_FIRST_RUN_WINDOW_MS,
  RECONCILE_OVERLAP_MS,
  RECONCILE_PAGE_LIMIT,
  RECONCILE_PAGE_SLEEP_MS,
  ReconciliationService
} from "./reconciliation.service";

function makeOrder(overrides: Partial<AccesstradeOrder> = {}): AccesstradeOrder {
  return {
    order_id: "ord-1",
    merchant: "shopee",
    billing: 500000,
    pub_commission: 50000,
    products_count: 1,
    order_approved: 1,
    order_pending: 0,
    order_reject: 0,
    is_confirmed: 1,
    sales_time: "2026-05-16T08:00:00Z",
    click_time: "2026-05-16T07:50:00Z",
    confirmed_time: "2026-05-16T09:00:00Z",
    update_time: "2026-05-16T09:00:00Z",
    at_product_link: "https://aff/x",
    landing_page: null,
    website: null,
    client_platform: "web",
    browser: "chrome",
    category_name: null,
    product_category: null,
    utm_source: "track-abc",
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    ...overrides
  };
}

interface WebhookRow {
  id: string;
  trackingCode: string;
  revenue: Prisma.Decimal;
  status: string;
  source: string | null;
  payload: Prisma.JsonValue | null;
  atOrderId: string | null;
  atCommission: Prisma.Decimal | null;
  reconcileNotes: string | null;
  lastReconciledAt: Date | null;
}

interface LogRow {
  id: string;
  triggeredBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  syncWindowStart: Date;
  syncWindowEnd: Date;
  fetched: number;
  matched: number;
  updated: number;
  unmatched: number;
  success: boolean;
  errorReason: string | null;
  durationMs: number | null;
}

class FakePrisma {
  webhooks = new Map<string, WebhookRow>();
  logs = new Map<string, LogRow>();
  private webhookSeq = 0;
  private logSeq = 0;

  conversionWebhook = {
    findFirst: jest.fn(
      async ({
        where
      }: {
        where: { trackingCode?: string; atOrderId?: string };
      }): Promise<WebhookRow | null> => {
        for (const row of this.webhooks.values()) {
          if (where.trackingCode && row.trackingCode === where.trackingCode) return row;
          if (where.atOrderId && row.atOrderId === where.atOrderId) return row;
        }
        return null;
      }
    ),
    update: jest.fn(
      async ({
        where,
        data
      }: {
        where: { id: string };
        data: Partial<WebhookRow>;
      }): Promise<WebhookRow> => {
        const row = this.webhooks.get(where.id);
        if (!row) throw new Error("webhook not found");
        Object.assign(row, data);
        return row;
      }
    )
  };

  reconciliationLog = {
    findFirst: jest.fn(
      async ({ where }: { where?: { success?: boolean } } = {}): Promise<LogRow | null> => {
        const all = [...this.logs.values()]
          .filter((l) => (where?.success === undefined ? true : l.success === where.success))
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        return all[0] ?? null;
      }
    ),
    create: jest.fn(
      async ({
        data
      }: {
        data: { triggeredBy: string; syncWindowStart: Date; syncWindowEnd: Date };
      }): Promise<LogRow> => {
        this.logSeq += 1;
        const row: LogRow = {
          id: `log-${this.logSeq}`,
          triggeredBy: data.triggeredBy,
          startedAt: new Date(),
          finishedAt: null,
          syncWindowStart: data.syncWindowStart,
          syncWindowEnd: data.syncWindowEnd,
          fetched: 0,
          matched: 0,
          updated: 0,
          unmatched: 0,
          success: false,
          errorReason: null,
          durationMs: null
        };
        this.logs.set(row.id, row);
        return row;
      }
    ),
    update: jest.fn(
      async ({
        where,
        data
      }: {
        where: { id: string };
        data: Partial<LogRow>;
      }): Promise<LogRow> => {
        const row = this.logs.get(where.id);
        if (!row) throw new Error("log not found");
        Object.assign(row, data);
        return row;
      }
    )
  };

  seedWebhook(partial: {
    trackingCode: string;
    revenue: number;
    status?: string;
    source?: string | null;
    atOrderId?: string | null;
  }): WebhookRow {
    this.webhookSeq += 1;
    const row: WebhookRow = {
      id: `wh-${this.webhookSeq}`,
      trackingCode: partial.trackingCode,
      revenue: new Prisma.Decimal(partial.revenue),
      status: partial.status ?? "pending",
      source: partial.source ?? "webhook",
      payload: {},
      atOrderId: partial.atOrderId ?? null,
      atCommission: null,
      reconcileNotes: null,
      lastReconciledAt: null
    };
    this.webhooks.set(row.id, row);
    return row;
  }

  seedLog(partial: Partial<LogRow> & { success: boolean; syncWindowEnd: Date }): LogRow {
    this.logSeq += 1;
    const row: LogRow = {
      id: `log-seed-${this.logSeq}`,
      triggeredBy: partial.triggeredBy ?? "cron",
      startedAt: partial.startedAt ?? new Date(),
      finishedAt: partial.finishedAt ?? new Date(),
      syncWindowStart: partial.syncWindowStart ?? new Date(),
      syncWindowEnd: partial.syncWindowEnd,
      fetched: partial.fetched ?? 0,
      matched: partial.matched ?? 0,
      updated: partial.updated ?? 0,
      unmatched: partial.unmatched ?? 0,
      success: partial.success,
      errorReason: partial.errorReason ?? null,
      durationMs: partial.durationMs ?? null
    };
    this.logs.set(row.id, row);
    return row;
  }
}

class FakeAccesstradeClient {
  pages: AccesstradeOrder[][] = [];
  fetchOrders = jest.fn(
    async ({ page }: { page?: number }): Promise<AccesstradeOrder[]> => {
      const idx = (page ?? 1) - 1;
      return this.pages[idx] ?? [];
    }
  );

  setPages(pages: AccesstradeOrder[][]): void {
    this.pages = pages;
  }
}

class TestableReconciliationService extends ReconciliationService {
  public sleepCalls: number[] = [];
  protected sleep(ms: number): Promise<void> {
    this.sleepCalls.push(ms);
    return Promise.resolve();
  }
}

async function buildService(): Promise<{
  service: TestableReconciliationService;
  prisma: FakePrisma;
  accesstrade: FakeAccesstradeClient;
}> {
  const prisma = new FakePrisma();
  const accesstrade = new FakeAccesstradeClient();
  const fakeSyncStatus = { wrap: async <T,>(_name: string, fn: () => Promise<T>) => fn() };
  const fakeOrderProductsSync = {
    syncRecent: async () => ({ orderProductsFetched: 0 })
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      TestableReconciliationService,
      { provide: PrismaService, useValue: prisma },
      { provide: AccesstradeClient, useValue: accesstrade },
      { provide: SyncStatusService, useValue: fakeSyncStatus },
      { provide: OrderProductsSyncService, useValue: fakeOrderProductsSync }
    ]
  }).compile();
  const service = moduleRef.get(TestableReconciliationService);
  return { service, prisma, accesstrade };
}

describe(ReconciliationService.name, () => {
  describe("runReconcileCycle", () => {
    it("matches webhook by utm_source and updates atOrderId + source=both", async () => {
      const { service, prisma, accesstrade } = await buildService();
      const webhook = prisma.seedWebhook({ trackingCode: "track-abc", revenue: 50000 });
      accesstrade.setPages([[makeOrder({ utm_source: "track-abc", order_id: "ord-xyz" })]]);

      const result = await service.runReconcileCycle("manual");

      expect(result).toEqual({ fetched: 1, matched: 1, updated: 1, unmatched: 0, orderProductsFetched: 0 });
      const updated = prisma.webhooks.get(webhook.id);
      expect(updated?.atOrderId).toBe("ord-xyz");
      expect(updated?.source).toBe("both");
      expect(updated?.lastReconciledAt).toBeInstanceOf(Date);
      expect(updated?.status).toBe("approved");
    });

    it("logs unmatched orders without creating new ConversionWebhook (FK safety)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.setPages([[makeOrder({ utm_source: "track-nonexistent", order_id: "ord-1" })]]);

      const result = await service.runReconcileCycle();

      expect(result).toEqual({ fetched: 1, matched: 0, updated: 0, unmatched: 1, orderProductsFetched: 0 });
      expect(prisma.webhooks.size).toBe(0);
      expect(prisma.conversionWebhook.update).not.toHaveBeenCalled();
    });

    it("writes reconcileNotes when revenue differs from pub_commission", async () => {
      const { service, prisma, accesstrade } = await buildService();
      const webhook = prisma.seedWebhook({ trackingCode: "track-abc", revenue: 100000 });
      accesstrade.setPages([
        [makeOrder({ utm_source: "track-abc", pub_commission: 80000 })]
      ]);

      await service.runReconcileCycle();
      const updated = prisma.webhooks.get(webhook.id);

      expect(updated?.reconcileNotes).toMatch(/delta=20000/);
    });

    it("leaves reconcileNotes null when revenue matches", async () => {
      const { service, prisma, accesstrade } = await buildService();
      const webhook = prisma.seedWebhook({ trackingCode: "track-abc", revenue: 50000 });
      accesstrade.setPages([
        [makeOrder({ utm_source: "track-abc", pub_commission: 50000 })]
      ]);

      await service.runReconcileCycle();
      const updated = prisma.webhooks.get(webhook.id);

      expect(updated?.reconcileNotes).toBeNull();
    });

    it("computeStatus maps approved/rejected/pending", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.seedWebhook({ trackingCode: "t1", revenue: 1 });
      prisma.seedWebhook({ trackingCode: "t2", revenue: 1 });
      prisma.seedWebhook({ trackingCode: "t3", revenue: 1 });
      accesstrade.setPages([
        [
          makeOrder({ utm_source: "t1", order_approved: 1, order_pending: 0, order_reject: 0 }),
          makeOrder({ utm_source: "t2", order_approved: 0, order_pending: 0, order_reject: 1 }),
          makeOrder({ utm_source: "t3", order_approved: 1, order_pending: 1, order_reject: 0 })
        ]
      ]);

      await service.runReconcileCycle();

      const statuses = [...prisma.webhooks.values()].map((w) => w.status);
      expect(statuses).toEqual(["approved", "rejected", "pending"]);
    });

    it("first run uses 24h lookback window", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.setPages([[]]);
      const before = Date.now();

      await service.runReconcileCycle();

      const callArgs = accesstrade.fetchOrders.mock.calls[0][0] as { since: Date; until: Date };
      const sinceMs = callArgs.since.getTime();
      const untilMs = callArgs.until.getTime();
      expect(untilMs - sinceMs).toBeGreaterThanOrEqual(RECONCILE_FIRST_RUN_WINDOW_MS - 5000);
      expect(untilMs - sinceMs).toBeLessThanOrEqual(RECONCILE_FIRST_RUN_WINDOW_MS + 5000);
      expect(untilMs).toBeGreaterThanOrEqual(before);
      const log = [...prisma.logs.values()][0];
      expect(log.success).toBe(true);
    });

    it("subsequent run uses (lastEnd - overlap) as since", async () => {
      const { service, prisma, accesstrade } = await buildService();
      const lastEnd = new Date("2026-05-16T10:00:00Z");
      prisma.seedLog({ success: true, syncWindowEnd: lastEnd });
      accesstrade.setPages([[]]);

      await service.runReconcileCycle();

      const callArgs = accesstrade.fetchOrders.mock.calls[0][0] as { since: Date };
      const expected = new Date(lastEnd.getTime() - RECONCILE_OVERLAP_MS);
      expect(callArgs.since.getTime()).toBe(expected.getTime());
    });

    it("paginates and sleeps between requests at rate-limit cadence", async () => {
      const { service, accesstrade } = await buildService();
      const fullPage = Array.from({ length: RECONCILE_PAGE_LIMIT }, (_, i) =>
        makeOrder({ utm_source: `none-${i}`, order_id: `ord-${i}` })
      );
      const partial = Array.from({ length: 10 }, (_, i) =>
        makeOrder({ utm_source: `none-p-${i}`, order_id: `ord-p-${i}` })
      );
      accesstrade.setPages([fullPage, partial]);

      const result = await service.runReconcileCycle();

      expect(accesstrade.fetchOrders).toHaveBeenCalledTimes(2);
      expect(service.sleepCalls).toEqual([RECONCILE_PAGE_SLEEP_MS]);
      expect(result.fetched).toBe(RECONCILE_PAGE_LIMIT + 10);
    });

    it("is idempotent — re-running with same order yields same final state", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.seedWebhook({ trackingCode: "track-abc", revenue: 50000 });
      accesstrade.setPages([[makeOrder({ utm_source: "track-abc", order_id: "ord-xyz" })]]);

      await service.runReconcileCycle();
      accesstrade.setPages([[makeOrder({ utm_source: "track-abc", order_id: "ord-xyz" })]]);
      const second = await service.runReconcileCycle();

      const rows = [...prisma.webhooks.values()];
      expect(rows.length).toBe(1);
      expect(rows[0].atOrderId).toBe("ord-xyz");
      expect(second).toEqual({ fetched: 1, matched: 1, updated: 1, unmatched: 0, orderProductsFetched: 0 });
    });

    it("falls back to atOrderId match when utm_source is missing", async () => {
      const { service, prisma, accesstrade } = await buildService();
      const webhook = prisma.seedWebhook({
        trackingCode: "track-abc",
        revenue: 50000,
        atOrderId: "ord-prev"
      });
      accesstrade.setPages([[makeOrder({ utm_source: null, order_id: "ord-prev" })]]);

      const result = await service.runReconcileCycle();

      expect(result.matched).toBe(1);
      expect(prisma.webhooks.get(webhook.id)?.atOrderId).toBe("ord-prev");
    });

    it("marks log as failed and rethrows when service crashes mid-cycle", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.fetchOrders.mockRejectedValueOnce(new Error("boom"));

      await expect(service.runReconcileCycle()).rejects.toThrow("boom");
      const log = [...prisma.logs.values()][0];
      expect(log.success).toBe(false);
      expect(log.errorReason).toContain("boom");
      expect(log.finishedAt).toBeInstanceOf(Date);
    });
  });
});
