# STORY-05 — Reconciliation poller (`/v1/order-list` → ConversionWebhook)

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 6h
**Dependencies:** [STORY-01](STORY-01-schema-migration.md) (cần `Campaign.atCampaignId` để map). Có thể chạy parallel với STORY-02/03/04.

## Context

Revenue attribution hiện tại **chỉ phụ thuộc webhook** ([webhooks.controller.ts](../../../../apps/api/src/modules/webhooks/webhooks.controller.ts)). Vấn đề:
1. Webhook có thể miss (network, AT downtime).
2. Webhook có thể late (1-2h).
3. Webhook không có cơ chế "verify cuối tháng": admin không biết tổng webhook nhận được có khớp tổng AT công nhận không.

`/v1/order-list` (doc [accesstrade.md mục 3.6](../../../integrations/accesstrade.md#36-get-v1order-list--danh-sách-đơn-hàng-v2-chưa-dùng)) là ground truth. Poll định kỳ → so sánh → update `ConversionWebhook` với data thật → admin có money-trail chính xác.

**Quan trọng**: reconciler KHÔNG thay webhook real-time. Webhook nhanh hơn (1-30s), reconciler chậm hơn (cycle 30 phút) nhưng đáng tin. Cả hai chạy song song, ưu tiên data của reconciler khi conflict.

## User story

> **As** admin DealVault,
> **I want** hệ thống tự pull `/v1/order-list` từ AT mỗi 30 phút và update conversion records,
> **so that** revenue trong Money Trail luôn khớp với AT dashboard, không phải lo webhook miss.

## Acceptance criteria

### AC1 — Schema: thêm `ReconciliationLog` + extend `ConversionWebhook`

Migration mới: `apps/api/prisma/migrations/<timestamp>_reconciliation/migration.sql`

```prisma
model ReconciliationLog {
  id              String   @id @default(uuid()) @db.Uuid
  triggeredBy     String                                          // "cron" | "manual"
  startedAt       DateTime @default(now())
  finishedAt      DateTime?
  syncWindowStart DateTime                                         // since param
  syncWindowEnd   DateTime                                         // until param
  fetched         Int      @default(0)                             // orders pulled
  matched         Int      @default(0)                             // có existing ConversionWebhook tương ứng
  updated         Int      @default(0)
  unmatched       Int      @default(0)                             // webhook miss — log warning
  success         Boolean  @default(false)
  errorReason     String?
  durationMs      Int?

  @@index([startedAt])
}
```

Thêm field vào `ConversionWebhook`:

```prisma
model ConversionWebhook {
  // ... existing ...
  source              String?  @default("webhook")   // "webhook" | "api-reconcile" | "both"
  lastReconciledAt    DateTime?
  atOrderId           String?                         // order_id từ /v1/order-list (khác transactionId nếu webhook payload khác format)
  atCommission        Decimal? @db.Decimal(10, 2)     // pub_commission từ AT — so sánh với revenue webhook
  reconcileNotes      String?                         // ghi chú khi mismatch (vd "webhook=100k, AT=80k, AT thấp hơn 20k")

  @@index([atOrderId])
  @@index([lastReconciledAt])
}
```

Chạy `npm run prisma:migrate --workspace api -- --name reconciliation`.

### AC2 — `AccesstradeClient.fetchOrders()`

File: [apps/api/src/modules/crawler/clients/accesstrade.client.ts](../../../../apps/api/src/modules/crawler/clients/accesstrade.client.ts)

Thêm method:

```ts
interface AccesstradeOrder {
  order_id: string;
  merchant: string;
  billing: number;
  pub_commission: number;
  products_count: number;
  order_approved: number;
  order_pending: number;
  order_reject: number;
  is_confirmed: 0 | 1;
  sales_time: string;
  click_time: string;
  confirmed_time: string | null;
  update_time: string;
  at_product_link: string;
  landing_page: string | null;
  website: string | null;
  client_platform: string;
  browser: string;
  category_name: string | null;
  product_category: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

interface OrderListResponse {
  data: AccesstradeOrder[];
  total: number;
}

async fetchOrders(opts: {
  since: Date;
  until: Date;
  page?: number;
  limit?: number;
  merchant?: string;
  status?: 0 | 1 | 2;
}): Promise<AccesstradeOrder[]> {
  if (!this.isConfigured()) return [];
  const base = process.env.ACCESSTRADE_API_BASE ?? "https://api.accesstrade.vn/v1";
  const params = new URLSearchParams();
  params.set("since", opts.since.toISOString());
  params.set("until", opts.until.toISOString());
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(Math.min(opts.limit, 300)));   // doc: max 300
  if (opts.merchant) params.set("merchant", opts.merchant);
  if (opts.status !== undefined) params.set("status", String(opts.status));

  const url = `${base}/order-list?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Token ${process.env.ACCESSTRADE_ACCESS_TOKEN}`,
        Accept: "application/json"
      }
    });
    if (!resp.ok) {
      const body = await resp.text();
      this.logger.error(`Accesstrade /order-list ${resp.status}: ${body.slice(0, 300)}`);
      return [];
    }
    const json = (await resp.json()) as OrderListResponse;
    return Array.isArray(json.data) ? json.data : [];
  } catch (error: unknown) {
    this.logger.error("Accesstrade fetchOrders failed", error instanceof Error ? error.message : String(error));
    return [];
  }
}
```

**Rate limit awareness**: doc nói 10 req/phút + cache 1 phút. `ReconciliationService` phải sleep giữa request khi pull nhiều page.

### AC3 — Service mới `ReconciliationService`

File mới: `apps/api/src/modules/reconciliation/reconciliation.service.ts`

```ts
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient } from "../crawler/clients/accesstrade.client";

interface ReconcileResult {
  fetched: number;
  matched: number;
  updated: number;
  unmatched: number;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  async runReconcileCycle(triggeredBy = "cron"): Promise<ReconcileResult> {
    // Sync window: từ (last successful sync - 10 min overlap) → now
    const lastLog = await this.prisma.reconciliationLog.findFirst({
      where: { success: true },
      orderBy: { startedAt: "desc" }
    });
    const overlapMs = 10 * 60 * 1000;
    const since = lastLog
      ? new Date(lastLog.syncWindowEnd.getTime() - overlapMs)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);  // lần đầu: 24h
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
        // Strategy 1: match theo utm_source (= trackingCode)
        let webhook = null;
        if (order.utm_source) {
          webhook = await this.prisma.conversionWebhook.findFirst({
            where: { trackingCode: order.utm_source }
          });
        }
        // Strategy 2 fallback: match theo atOrderId (order đã reconcile trước)
        if (!webhook) {
          webhook = await this.prisma.conversionWebhook.findFirst({
            where: { atOrderId: order.order_id }
          });
        }

        if (!webhook) {
          unmatched += 1;
          this.logger.warn(`Reconcile: order ${order.order_id} (utm_source=${order.utm_source ?? "null"}) không match webhook nào — webhook có thể miss`);
          continue;
        }

        matched += 1;

        // Compute status mới
        const newStatus = this.computeStatus(order);
        // Compute reconcile note nếu mismatch
        let note: string | null = null;
        const webhookRevenue = Number(webhook.revenue);
        const atCommission = Number(order.pub_commission);
        if (Math.abs(webhookRevenue - atCommission) > 1) {
          note = `webhook revenue=${webhookRevenue}, AT pub_commission=${atCommission} (delta=${(webhookRevenue - atCommission).toFixed(2)})`;
        }

        await this.prisma.conversionWebhook.update({
          where: { id: webhook.id },
          data: {
            atOrderId: order.order_id,
            atCommission: new Prisma.Decimal(order.pub_commission),
            status: newStatus,
            source: webhook.source === "webhook" ? "both" : "api-reconcile",
            lastReconciledAt: new Date(),
            reconcileNotes: note,
            payload: {
              ...((webhook.payload as Prisma.JsonObject) ?? {}),
              atOrder: order as unknown as Prisma.JsonValue
            }
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

      this.logger.log(`Reconcile: ${orders.length} fetched, ${matched} matched, ${updated} updated, ${unmatched} unmatched (webhook miss)`);
      return { fetched: orders.length, matched, updated, unmatched };
    } catch (error) {
      await this.prisma.reconciliationLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          success: false,
          errorReason: (error as Error).message.slice(0, 1000),
          durationMs: Date.now() - start
        }
      });
      throw error;
    }
  }

  private computeStatus(order: AccesstradeOrder): string {
    // Map AT order trạng thái → ConversionWebhook.status (string)
    if (order.order_approved > 0 && order.order_pending === 0 && order.order_reject === 0) {
      return "approved";
    }
    if (order.order_reject > 0 && order.order_approved === 0) {
      return "rejected";
    }
    return "pending";  // mixed hoặc all-pending
  }

  private async fetchAllOrders(since: Date, until: Date) {
    const all = [];
    const LIMIT = 300;
    let page = 1;
    while (page < 20) {  // safety cap: 20 pages × 300 = 6000 orders/cycle
      const batch = await this.accesstrade.fetchOrders({ since, until, page, limit: LIMIT });
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < LIMIT) break;
      page += 1;
      // Rate limit: 10 req/phút → sleep 7s giữa request
      await new Promise((r) => setTimeout(r, 7000));
    }
    return all;
  }
}
```

### AC4 — Module mới `ReconciliationModule`

File mới: `apps/api/src/modules/reconciliation/reconciliation.module.ts`

```ts
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { CrawlerModule } from "../crawler/crawler.module";
import { ReconciliationScheduler } from "./reconciliation.scheduler";
import { ReconciliationService } from "./reconciliation.service";

@Module({
  imports: [ScheduleModule.forRoot(), CrawlerModule],   // import CrawlerModule để dùng AccesstradeClient
  providers: [PrismaService, ReconciliationService, ReconciliationScheduler],
  exports: [ReconciliationService]
})
export class ReconciliationModule {}
```

Register vào [app.module.ts](../../../../apps/api/src/modules/app.module.ts).

`AccesstradeClient` cần export từ `CrawlerModule` — verify [crawler.module.ts](../../../../apps/api/src/modules/crawler/crawler.module.ts) có `exports: [AccesstradeClient, ...]`. Nếu chưa, thêm.

### AC5 — Scheduler

File mới: `apps/api/src/modules/reconciliation/reconciliation.scheduler.ts`

```ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ReconciliationService } from "./reconciliation.service";

@Injectable()
export class ReconciliationScheduler {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  constructor(private readonly reconciler: ReconciliationService) {}

  // Mặc định mỗi 30 phút
  @Cron(process.env.RECONCILE_CRON ?? CronExpression.EVERY_30_MINUTES, {
    name: "reconciliation-cycle"
  })
  async handleCron() {
    if (process.env.RECONCILE_ENABLED === "false") {
      this.logger.debug("Reconciliation disabled via env");
      return;
    }
    try {
      await this.reconciler.runReconcileCycle("cron");
    } catch (error) {
      this.logger.error("Reconciliation cycle failed", error instanceof Error ? error.stack : String(error));
    }
  }
}
```

### AC6 — Admin endpoints

[admin.controller.ts](../../../../apps/api/src/modules/admin/admin.controller.ts):

```ts
@Post("reconciliation/run")
async runReconciliation(
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["admin"]);
  return this.reconciliation.runReconcileCycle("manual");
}

@Get("reconciliation/logs")
async getReconciliationLogs(
  @Query("limit") limit?: string,
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
  return this.prisma.reconciliationLog.findMany({
    orderBy: { startedAt: "desc" },
    take: Math.min(Number(limit ?? 20), 100)
  });
}
```

Inject `ReconciliationService` + register `AppModule` cần import `ReconciliationModule`.

### AC7 — UI: hiển thị source + reconcile note trong money-trail

File: [apps/web/components/admin/money-trail-table.tsx](../../../../apps/web/components/admin/money-trail-table.tsx)

Thêm cột:
- **Source** — badge `webhook` (xám) / `api-reconcile` (xanh) / `both` (xanh đậm).
- **Mismatch** — nếu `reconcileNotes != null`, hiển thị icon ⚠️ với tooltip note.
- **Last reconciled** — relative time `lastReconciledAt`.

Thêm filter ở top: "Hiện chỉ rows có mismatch" — query backend với `reconcileNotes IS NOT NULL`.

### AC8 — UI: list reconciliation logs

File mới: `apps/web/app/admin/reconciliation/page.tsx`

Table đơn giản hiển thị `ReconciliationLog`:
- triggeredBy, startedAt, finishedAt
- fetched, matched, updated, unmatched
- success (icon ✓/✗)
- errorReason (nếu fail)
- durationMs

Button "Run now" (gọi `POST /admin/reconciliation/run` qua server action).

### AC9 — Env mới

File: [apps/api/.env.example](../../../../apps/api/.env.example)

```
# ----- Reconciliation -----
# Set false to disable scheduled reconciliation (manual /admin/reconciliation/run still works).
RECONCILE_ENABLED=true
# Cron expression. Default: every 30 minutes.
RECONCILE_CRON="*/30 * * * *"
```

### AC10 — Unit test `ReconciliationService`

File mới: `apps/api/src/modules/reconciliation/reconciliation.service.spec.ts`

Theo chuẩn `mt-dev` section 2.2 (test bắt buộc khi thêm service). Đặc biệt critical vì service này tính tiền — sai = sai attribution doanh thu. Cover:

- **Match flow:** mock `AccesstradeClient.fetchOrders()` trả 1 order với `utm_source = "abc123"`, Prisma trả `ConversionWebhook { trackingCode: "abc123" }` → `matched=1, updated=1, unmatched=0`; verify webhook update có `atOrderId`, `source="both"`, `lastReconciledAt` set.
- **Unmatched flow:** order có `utm_source` không match ClickLog nào → `unmatched++`, **không** tạo ConversionWebhook mới (tránh FK violation), log warning.
- **Mismatch revenue:** webhook tồn tại với `revenue=100000`, AT trả `pub_commission=80000` → `reconcileNotes` chứa `delta=20000` (hoặc text tương đương).
- **`computeStatus()`:** order `{approved=1, pending=0, reject=0}` → `"approved"`; `{reject=1, approved=0}` → `"rejected"`; mixed → `"pending"`.
- **First-run window:** `lastSuccessfulRun` null trong DB → `since = now - 24h`; có giá trị → `since = lastRun - 10min`.
- **Pagination + rate limit:** mock 2 page (300 + 50) → 2 lần fetch; spy `setTimeout` được gọi với 7000ms giữa các page.
- **Idempotent:** chạy lần 2 với cùng data → `updated` count = 0 hoặc không thay đổi `atOrderId` (verify không append duplicate).

Pattern: `describe(ReconciliationService) > describe(runReconcileCycle) > it("...")`. Inject mock Prisma + mock `AccesstradeClient` via `Test.createTestingModule()`. Dùng `jest.useFakeTimers()` cho rate-limit assertion.

### AC11 — Cập nhật doc

[docs/integrations/accesstrade.md](../../../integrations/accesstrade.md):
- Mục 3.6 (`/v1/order-list`): đánh dấu "(đang dùng)".
- Section 5 Mapping: thêm dòng `order_id` → `ConversionWebhook.atOrderId`.

[apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md):
- Section mới "Reconciliation" mô tả pattern poller + tần suất.

## Technical breakdown

### Files mới
- `apps/api/prisma/migrations/<timestamp>_reconciliation/migration.sql`
- `apps/api/src/modules/reconciliation/reconciliation.module.ts`
- `apps/api/src/modules/reconciliation/reconciliation.service.ts`
- `apps/api/src/modules/reconciliation/reconciliation.service.spec.ts`
- `apps/api/src/modules/reconciliation/reconciliation.scheduler.ts`
- `apps/web/app/admin/reconciliation/page.tsx`

### Files sửa
- `apps/api/prisma/schema.prisma` — thêm `ReconciliationLog`, extend `ConversionWebhook`.
- `apps/api/src/modules/crawler/clients/accesstrade.client.ts` — `fetchOrders`.
- `apps/api/src/modules/crawler/crawler.module.ts` — export `AccesstradeClient` nếu chưa.
- `apps/api/src/modules/app.module.ts` — register `ReconciliationModule`.
- `apps/api/src/modules/admin/admin.controller.ts` — 2 endpoint mới.
- `apps/api/.env.example` — env mới.
- `apps/web/components/admin/money-trail-table.tsx` — cột mới.
- `apps/web/app/admin/money-trail/...` — filter "show mismatch only".
- Doc updates.

## API contract

**`POST /api/v1/admin/reconciliation/run`** — trigger manual, admin role.

**`GET /api/v1/admin/reconciliation/logs?limit=20`** — list logs, viewer+ role.

## Definition of Done

- [ ] Migration apply clean.
- [ ] Scheduler chạy mỗi 30 phút (verify bằng log "Reconciliation cycle started").
- [ ] Lần đầu chạy → fetch 24h lịch sử; lần sau → fetch từ last_sync - 10min.
- [ ] Order có `utm_source` match `trackingCode` của ClickLog → update `ConversionWebhook`.
- [ ] Order không match nào → `unmatched++`, log warning.
- [ ] Rate limit: log thấy sleep 7s giữa request (verify khi có > 300 orders).
- [ ] Money-trail UI hiển thị `source` badge + mismatch icon.
- [ ] Test manual: insert giả 1 ConversionWebhook với `revenue=100000`, mock AT trả `pub_commission=80000` → reconcile note "delta=20000".
- [ ] `reconciliation.service.spec.ts` pass — cover match/unmatched/mismatch/computeStatus/first-run window/pagination rate-limit/idempotent.
- [ ] `npm run test:api` pass.

## Out of scope

- **Auto-tạo ConversionWebhook khi unmatched**: chỉ log warning. Lý do: webhook là channel "real-time"; nếu webhook miss hẳn, có khả năng cấu hình hai bên đang sai → tạo row giả sẽ che bug. Admin xem unmatched logs sẽ biết hành động.
- **Reconcile theo product line** (`/v1/order-products`): chỉ order-level ở story này. Product-level analytics là Phase sau.
- **UI alert khi unmatched > threshold**: chưa cần.
- **Rollback khi mismatch lớn**: chỉ ghi note, không rollback. Admin tự decide trust source nào trong /admin/money-trail.

## Notes cho AI agent

- **Rate limit**: doc nói rõ 10 req/phút. `setTimeout(7000)` giữa request là minimum. Nếu nhiều page (vd 10 page), tổng 70s — chấp nhận chạy chậm; cron 30 phút có buffer.
- **`utm_source` của AT** = `ClickLog.trackingCode` của ta (vì web action [createTrackingRedirect()](../../../../apps/web/app/...) ghi `utm_source=<trackingCode>`). Match điểm này là nguyên lý cốt lõi — verify bằng cách click 1 product → đợi 1 phút → trong DB `ClickLog.trackingCode` = `ConversionWebhook.trackingCode` = `AccesstradeOrder.utm_source`.
- **`Prisma.Decimal`**: convert từ number bằng `new Prisma.Decimal(value)`. So sánh dùng `.equals()` hoặc convert sang Number cho delta nhỏ.
- **`JsonValue` merge**: khi update `payload` JSON, đảm bảo cast: `(webhook.payload as Prisma.JsonObject) ?? {}`. Không spread JsonValue trực tiếp.
- **`updated_time_*` query params**: doc list nhưng story này chỉ dùng `since`/`until` (theo sales_time). Variant theo update time cho phase 2 nếu cần.
- **First-run window**: 24h là arbitrary. Nếu muốn longer backfill, admin gọi `/run` tay nhiều lần với cron disabled.
- **Don't break ConversionWebhook foreign key**: relation `trackingCode → ClickLog.trackingCode` với `onDelete: Restrict`. Nếu reconcile tìm thấy order có utm_source mới (không có ClickLog) → KHÔNG tạo ConversionWebhook (sẽ FK error). Chỉ log unmatched.
- **Status string**: ConversionWebhook.status hiện là `String`, không enum. Giữ string `"approved"|"pending"|"rejected"` cho consistent.
