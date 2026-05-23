# STORY-02 — Manual sync mode: disable cron + "Đồng bộ tất cả" mega-button + last-sync status

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 4h
**Dependencies:** STORY-01 (AT-only cleanup) — sync flow chỉ còn 1 network.

## Context

4 backbone cron đang chạy ngầm:
- Crawler (6h) — pull AT datafeeds
- Reconciler (30 phút) — pull AT order-list
- Coupon sync (6h) — pull AT coupons
- Top products (3h sáng) — daily snapshot

Vấn đề với operator gà mờ:
- Cron silent failure → operator ko biết khi nào ngừng.
- Yêu cầu hosting tier 24/7 (Vercel free tier serverless ko hỗ trợ background cron).
- Operator ko cảm thấy control — data tự đổi không hiểu vì sao.
- Multiple cron = multiple failure modes.

Quyết định sprint: **full-manual mode**, tất cả qua 1 button "Đồng bộ tất cả" trên admin homepage. Code cron giữ nguyên — chỉ env flag off. Khi nào ready bật lại = đổi 1 dòng .env, ko cần code change.

4 backbone cron đã có sẵn 4 env flag:
- `CRAWLER_ENABLED` — verify exists ở `crawler.scheduler.ts`
- `RECONCILE_ENABLED` — verify exists ở `reconciliation.scheduler.ts`
- `COUPON_SYNC_ENABLED` — verify exists ở `coupon-sync.scheduler.ts`
- `TOP_PRODUCTS_ENABLED` — verify exists ở `top-products-sync.scheduler.ts`

4 manual endpoint đã tồn tại (per CLAUDE.md):
- `POST /api/v1/admin/crawler/run`
- `POST /api/v1/admin/reconciliation/run`
- `POST /api/v1/admin/coupons/sync-from-at`
- `POST /api/v1/admin/top-products/sync`

Story này wire UI + add "last sync" tracking + 1 mega-button orchestrate 4 endpoint.

## User story

> **As** gà mờ operator,
> **I want** 1 button "Đồng bộ tất cả" buổi sáng để tự pull data fresh từ AT, biết rõ lần cuối sync khi nào,
> **so that** tôi không cần cron 24/7, không sợ silent failure, hiểu data thay đổi vì sao.

## Acceptance criteria

### AC1 — Disable 4 backbone cron

Update `apps/api/.env.example`:

```env
# === Backbone sync mode ===
# 4 cron backbone đang OFF mặc định — operator chạy manual qua admin button "Đồng bộ tất cả".
# Khi muốn bật cron tự chạy 24/7: set true (cần hosting tier hỗ trợ background process).
CRAWLER_ENABLED=false
RECONCILE_ENABLED=false
COUPON_SYNC_ENABLED=false
TOP_PRODUCTS_ENABLED=false

# Tần suất cron khi enabled (ko ảnh hưởng manual mode)
CRAWLER_CRON=0 */6 * * *
RECONCILE_CRON=*/30 * * * *
COUPON_SYNC_CRON=0 */6 * * *
TOP_PRODUCTS_CRON=0 3 * * *
```

Operator chỉ cần copy `.env.example` → `.env`, mặc định manual. Khi nào ready bật cron = đổi 4 dòng `=true`.

Update `apps/api/.env` (real env) tương tự — set 4 flag false.

### AC2 — Add `LastSyncStatus` model

Migration: `apps/api/prisma/schema.prisma`:

```prisma
model LastSyncStatus {
  name             String   @id                       // "crawler" | "reconcile" | "coupon" | "top_products" | "commission_rank" | "keyword_radar"
  lastRunAt        DateTime?
  lastSuccessAt    DateTime?
  lastError        String?  @db.Text
  lastDurationMs   Int?
  lastResult       Json?    @db.JsonB                 // { fetched, imported, ... } per service
  expectedFrequencySec Int                            // 21600 (6h) cho crawler, 1800 (30m) cho reconcile, ...
  isStale          Boolean  @default(false)           // computed: now - lastSuccessAt > 2 × expectedFrequency
  updatedAt        DateTime @updatedAt

  @@index([isStale])
}
```

Migration: `npm run db:migrate -- --name add_last_sync_status` từ root.

Seed 6 rows (3 cho 4 backbone + 2 cho money loop sync):

```js
// apps/api/prisma/seed.js — add:
await prisma.lastSyncStatus.createMany({
  data: [
    { name: "crawler", expectedFrequencySec: 21600 },
    { name: "reconcile", expectedFrequencySec: 1800 },
    { name: "coupon", expectedFrequencySec: 21600 },
    { name: "top_products", expectedFrequencySec: 86400 },
    { name: "commission_rank", expectedFrequencySec: 604800 },  // weekly
    { name: "keyword_radar", expectedFrequencySec: 604800 }     // weekly
  ],
  skipDuplicates: true
});
```

### AC3 — Wire `LastSyncStatus` vào 4 backbone service

Mỗi service khi chạy manual hoặc cron, update record tương ứng. Tạo helper `apps/api/src/services/sync-status.service.ts`:

```ts
@Injectable()
export class SyncStatusService {
  constructor(private prisma: PrismaService) {}

  async wrap<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await fn();
      await this.prisma.lastSyncStatus.update({
        where: { name },
        data: {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          lastError: null,
          lastDurationMs: Date.now() - startedAt,
          lastResult: result as Prisma.InputJsonValue,
          isStale: false
        }
      });
      return result;
    } catch (err) {
      await this.prisma.lastSyncStatus.update({
        where: { name },
        data: {
          lastRunAt: new Date(),
          lastError: err instanceof Error ? err.message : String(err),
          lastDurationMs: Date.now() - startedAt
        }
      });
      throw err;
    }
  }
}
```

Update 4 service `run()` method wrap qua `syncStatusService.wrap("<name>", () => actualLogic())`:
- `crawler.service.ts → runFullCycle()` wrap `"crawler"`
- `reconciliation.service.ts → runCycle()` wrap `"reconcile"`
- `coupon-sync.service.ts → syncFromAccesstrade()` wrap `"coupon"`
- `top-products-sync.service.ts → snapshotToday()` wrap `"top_products"`

### AC4 — Cron `isStale` updater (1 cron sống sót)

Để widget hiển thị status đúng kể cả service chưa run lại, cần 1 cron nhẹ update `isStale` flag.

NEW: `apps/api/src/services/stale-status.scheduler.ts`:

```ts
@Injectable()
export class StaleStatusScheduler {
  @Cron("*/10 * * * *") // every 10 min, cheap pure-DB query
  async refreshStaleness() {
    const all = await this.prisma.lastSyncStatus.findMany();
    const now = Date.now();
    for (const r of all) {
      const lastSuccess = r.lastSuccessAt?.getTime() ?? 0;
      const threshold = r.expectedFrequencySec * 2 * 1000;
      const stale = lastSuccess === 0 || (now - lastSuccess > threshold);
      if (stale !== r.isStale) {
        await this.prisma.lastSyncStatus.update({
          where: { name: r.name },
          data: { isStale: stale }
        });
      }
    }
  }
}
```

**Lưu ý**: cron này **không đụng AT**, chỉ DB. Hosting nào cũng chạy được (kể cả Vercel cron). Có thể tắt bằng env `STALE_STATUS_ENABLED=true` (default true) — đây là cron DUY NHẤT giữ lại.

Alternative nếu muốn 0 cron: compute `isStale` runtime trong widget query (`isStale = now - lastSuccessAt > 2× expected`). Cost: mỗi admin dashboard load tính lại. **Pick**: compute runtime, KHÔNG cần cron. Update AC: bỏ `StaleStatusScheduler`, thay bằng helper function trong API response.

### AC5 — Endpoint `GET /admin/sync/status`

Trong `AdminController`:

```ts
@Get("sync/status")
async getSyncStatus(
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
  const rows = await this.prisma.lastSyncStatus.findMany({ orderBy: { name: "asc" } });
  const now = Date.now();
  return rows.map(r => {
    const lastSuccess = r.lastSuccessAt?.getTime() ?? 0;
    const threshold = r.expectedFrequencySec * 2 * 1000;
    const isStale = lastSuccess === 0 || (now - lastSuccess > threshold);
    const ageSec = lastSuccess > 0 ? Math.floor((now - lastSuccess) / 1000) : null;
    return {
      name: r.name,
      lastRunAt: r.lastRunAt,
      lastSuccessAt: r.lastSuccessAt,
      lastError: r.lastError,
      lastDurationMs: r.lastDurationMs,
      lastResult: r.lastResult,
      expectedFrequencySec: r.expectedFrequencySec,
      isStale,
      ageSec
    };
  });
}
```

### AC6 — Endpoint `POST /admin/sync/all` — mega-button orchestrator

```ts
@Post("sync/all")
async syncAll(
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);

  const results: Record<string, { ok: boolean; ms: number; data?: any; error?: string }> = {};

  // Tuần tự, KHÔNG parallel (tránh AT rate-limit)
  for (const [name, runner] of [
    ["crawler", () => this.crawlerService.runFullCycle()],
    ["reconcile", () => this.reconciliationService.runCycle()],
    ["coupon", () => this.couponSyncService.syncFromAccesstrade()],
    ["top_products", () => this.topProductsService.snapshotToday()],
    // Loop 1+2 lazy fetch — STORY-04 sẽ thêm:
    // ["commission_rank", () => this.commissionRankService.refresh()],
    // ["keyword_radar", () => this.keywordRadarService.refresh()]
  ] as const) {
    const start = Date.now();
    try {
      const data = await runner();
      results[name] = { ok: true, ms: Date.now() - start, data };
    } catch (err) {
      results[name] = { ok: false, ms: Date.now() - start, error: String(err) };
    }
    // sleep 1.5s giữa endpoint để khỏi AT rate-limit
    await new Promise(r => setTimeout(r, 1500));
  }

  return { ok: true, results, totalMs: Object.values(results).reduce((s, r) => s + r.ms, 0) };
}
```

### AC7 — Endpoint `POST /admin/sync/:name` — single

```ts
@Post("sync/:name")
async syncOne(
  @Param("name") name: string,
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);
  const allowed = ["crawler", "reconcile", "coupon", "top_products"];
  if (!allowed.includes(name)) throw new HttpException("Unknown sync name", HttpStatus.BAD_REQUEST);
  // dispatch tới service tương ứng
}
```

### AC8 — Admin UI: SyncAllButton component

Component sẽ được mount trong STORY-03 admin dashboard. Story này chỉ tạo component standalone, ready để mount.

NEW: `apps/web/components/admin/sync/sync-all-button.tsx` (client component).

```tsx
"use client";
import { useState } from "react";
import { Loader2, Check, X, RefreshCw } from "lucide-react";

interface Props {
  onComplete?: () => void; // callback để refresh dashboard data
}

export function SyncAllButton({ onComplete }: Props) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, { ok: boolean; ms: number; error?: string }> | null>(null);

  const runSync = async () => {
    setRunning(true);
    setResults(null);
    try {
      const res = await fetch("/api/admin/sync/all", { method: "POST" });
      const data = await res.json();
      setResults(data.results);
      onComplete?.();
    } catch (err) {
      // show toast error
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-ink">Đồng bộ dữ liệu</h3>
          <p className="mt-0.5 text-xs text-ink-soft">Pull deal mới + đối soát đơn + sync mã + snapshot top deal</p>
        </div>
        <button
          onClick={runSync}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {running ? "Đang đồng bộ..." : "Đồng bộ tất cả"}
        </button>
      </div>

      {(running || results) && (
        <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          {["crawler", "reconcile", "coupon", "top_products"].map(name => {
            const r = results?.[name];
            const label = LABELS[name];
            return (
              <li key={name} className="flex items-center gap-2">
                {!r ? (
                  running ? <Loader2 className="size-3.5 animate-spin text-ink-mute" /> : <span className="size-3.5 rounded-full bg-line" />
                ) : r.ok ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <X className="size-3.5 text-red-600" />
                )}
                <span className="flex-1">{label}</span>
                {r ? <span className="text-xs text-ink-mute">{r.ms}ms</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const LABELS: Record<string, string> = {
  crawler: "Pull deal mới",
  reconcile: "Đối soát đơn",
  coupon: "Sync mã giảm",
  top_products: "Snapshot top deal"
};
```

### AC9 — Admin UI: LastSyncStatusWidget

NEW: `apps/web/components/admin/sync/last-sync-status-widget.tsx` (server component, RSC fetch).

```tsx
import { adminFetch } from "../ui/admin-fetch";

interface SyncStatus {
  name: string;
  lastSuccessAt: string | null;
  isStale: boolean;
  ageSec: number | null;
  lastError: string | null;
}

const LABELS = { crawler: "Crawler", reconcile: "Đối soát", coupon: "Coupon", top_products: "Top deal" };

export async function LastSyncStatusWidget() {
  const data = await adminFetch<SyncStatus[]>("/admin/sync/status", "GET");
  const backbone = data.filter(d => ["crawler", "reconcile", "coupon", "top_products"].includes(d.name));
  const allOk = backbone.every(d => !d.isStale && !d.lastError);

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h3 className="text-sm font-semibold text-ink">HỆ THỐNG (4 luồng nền)</h3>
      <ul className="mt-3 space-y-1.5 text-xs">
        {backbone.map(d => (
          <li key={d.name} className="flex items-center gap-2">
            {d.isStale || d.lastError ? <X className="size-3 text-red-600" /> : <Check className="size-3 text-emerald-600" />}
            <span className="flex-1">{LABELS[d.name]}</span>
            <span className={`text-[11px] ${d.isStale ? "text-red-600" : "text-ink-mute"}`}>
              {d.lastSuccessAt ? `${formatAgo(d.ageSec)}` : "chưa chạy"}
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-3 text-xs font-medium ${allOk ? "text-emerald-700" : "text-red-700"}`}>
        {allOk ? "→ Tất cả OK" : "→ Cần đồng bộ"}
      </p>
    </div>
  );
}

function formatAgo(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s trước`;
  if (sec < 3600) return `${Math.floor(sec / 60)} phút`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h trước`;
  return `${Math.floor(sec / 86400)} ngày`;
}
```

### AC10 — Banner cảnh báo + email reminder (optional cron sống sót)

Trên admin layout, nếu bất cứ backbone nào `isStale`, render banner đỏ:

```tsx
{anyStale && (
  <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800">
    ⚠ Dữ liệu đang lag — {staleCount} luồng chưa đồng bộ &gt; 2× tần suất. <Link href="/admin">Đồng bộ ngay →</Link>
  </div>
)}
```

Email reminder (optional, ko bắt buộc trong story này):
- Cron nhẹ 9h sáng VN — query `LastSyncStatus.isStale=true` count → nếu ≥1 → send email tới `ADMIN_EMAIL` env.
- Defer sang sprint sau nếu chưa setup email send infrastructure.

## Files touched

```
apps/api/prisma/schema.prisma                                    (add LastSyncStatus model)
apps/api/prisma/migrations/<ts>_add_last_sync_status/migration.sql  (NEW)
apps/api/prisma/seed.js                                          (seed 6 rows)
apps/api/src/services/sync-status.service.ts                      (NEW helper)
apps/api/src/modules/crawler/crawler.service.ts                  (wrap runFullCycle với syncStatus)
apps/api/src/modules/reconciliation/reconciliation.service.ts    (wrap runCycle)
apps/api/src/modules/crawler/coupon-sync.service.ts              (wrap syncFromAccesstrade)
apps/api/src/modules/crawler/top-products-sync.service.ts        (wrap snapshotToday)
apps/api/src/modules/admin/admin.controller.ts                   (add sync/status + sync/all + sync/:name endpoint)
apps/api/.env.example                                            (4 flag = false default + comment block)
apps/api/.env                                                    (4 flag = false)
apps/web/components/admin/sync/sync-all-button.tsx               (NEW client)
apps/web/components/admin/sync/last-sync-status-widget.tsx       (NEW RSC)
apps/web/app/admin/actions.ts                                    (add syncAll + syncStatus server actions)
apps/web/app/api/admin/sync/all/route.ts                         (NEW Next API proxy → forward header tới Nest)
apps/web/app/api/admin/sync/status/route.ts                      (NEW Next API proxy)
```

## Verification

```bash
# 1. Migration
npm run db:migrate -- --name add_last_sync_status
psql -c "\d LastSyncStatus"
# expect: 6 rows after seed

# 2. Manual sync endpoint
curl -X POST http://localhost:4000/api/v1/admin/sync/crawler \
  -H "x-admin-role: admin" -H "x-admin-key: $ADMIN_API_KEY"
# expect: {ok: true, fetched: N, ...}

# 3. Sync all
curl -X POST http://localhost:4000/api/v1/admin/sync/all \
  -H "x-admin-role: admin" -H "x-admin-key: $ADMIN_API_KEY"
# expect: {ok: true, results: { crawler: {ok:true}, reconcile: {ok:true}, coupon: {ok:true}, top_products: {ok:true} }, totalMs: N}

# 4. Status query
curl http://localhost:4000/api/v1/admin/sync/status \
  -H "x-admin-role: admin" -H "x-admin-key: $ADMIN_API_KEY"
# expect: 6 rows, lastSuccessAt populated cho 4 backbone, isStale=false

# 5. Cron đã off
# Khởi động lại API. Đợi 30 phút. Kiểm tra LastSyncStatus.crawler.lastRunAt KHÔNG update tự động.
# Verify: cron decorator vẫn có nhưng env=false → service skip.

# 6. Stale detection
# Update LastSyncStatus.crawler.lastSuccessAt = 25 hours ago
# GET /admin/sync/status → isStale=true cho crawler

# 7. Frontend integration
# Open /admin → see SyncAllButton + LastSyncStatusWidget rendered
# Click "Đồng bộ tất cả" → progress shown step-by-step
```

## Definition of done

- [ ] 4 backbone env flag = false default trong .env.example + .env.
- [ ] `LastSyncStatus` model migration applied + seeded 6 row.
- [ ] `SyncStatusService.wrap()` wired vào 4 backbone service.
- [ ] `POST /admin/sync/all` orchestrate 4 endpoint tuần tự với 1.5s sleep.
- [ ] `GET /admin/sync/status` trả status đầy đủ với `isStale` compute runtime.
- [ ] `SyncAllButton` client component có progress UI + result feedback.
- [ ] `LastSyncStatusWidget` RSC render 4 backbone status với ago format.
- [ ] Banner cảnh báo render khi `anyStale=true`.
- [ ] Manual click "Đồng bộ tất cả" → 4 endpoint chạy tuần tự → total ≤ 3 phút.
- [ ] Documented trong `apps/api/CLAUDE.md` rằng "Manual sync mode" là default.

## Notes for next session

- Hosting Vercel free tier: serverless function timeout 60s. `runFullCycle` có thể chạy 2-3 phút. Cần move `POST /admin/sync/all` sang **background task** với polling status, HOẶC deploy API lên Railway/Render (hỗ trợ long-running). Document trade-off.
- Nếu deploy Vercel: split sync-all thành 4 separate request từ client, hoặc dùng Edge function với streaming response.
- Email reminder cron 9h sáng — defer sang sprint sau (cần email send setup).
- STORY-03 sẽ mount `SyncAllButton` + `LastSyncStatusWidget` vào dashboard layout.
- STORY-04 sẽ add 2 entry `commission_rank` + `keyword_radar` vào `sync-all` orchestrator.
- STORY-05 sẽ hook order-products sync vào reconcile flow (đã wrapped) — không cần thêm entry.
