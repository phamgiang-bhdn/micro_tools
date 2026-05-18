# STORY-02 — Sync campaigns từ `/v1/campaigns?approval=successful`

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 4h
**Dependencies:** [STORY-01](STORY-01-schema-migration.md) (schema fields `atCampaignId`, `atRawData`, ... phải tồn tại).

## Context

Bước này biến AT thành **upstream chính của Campaign**. Hiện tại Campaign được auto-create từ `offer.campaign` STRING trong `/v1/datafeeds` ([import.service.ts:114](../../../../apps/api/src/modules/crawler/import.service.ts#L114)) — không có id thật, không có metadata (logo, scope, cookie duration, start/end time).

Story này thêm method `AccesstradeClient.fetchCampaigns()` + admin endpoint trigger sync, để khi admin apply campaign trong AT dashboard → đợi duyệt → bấm "Sync" trong /admin → campaign tự về DB với đầy đủ metadata, sẵn sàng để STORY-04 assign vào Category.

**Reference doc**: [accesstrade.md mục 3.2](../../../integrations/accesstrade.md) — `GET /v1/campaigns?approval=successful`.

## User story

> **As** admin DealVault,
> **I want** bấm 1 nút "Sync from Accesstrade" trong /admin/campaigns để pull tất cả campaign đã duyệt từ AT về DB,
> **so that** tôi thấy campaign thật với id, logo, merchant name, không phải chỉ slug do hệ thống tự sinh.

## Acceptance criteria

### AC1 — Method mới trong `AccesstradeClient`

File: [apps/api/src/modules/crawler/clients/accesstrade.client.ts](../../../../apps/api/src/modules/crawler/clients/accesstrade.client.ts)

Thêm method:

```ts
interface AccesstradeCampaign {
  id: string;                     // id thật, vd "5585194803623188142"
  name: string;
  merchant: string;
  approval: "unregistered" | "pending" | "successful";
  status: number;                 // 1 = Running
  logo?: string;
  url?: string;
  scope?: "public" | "private";
  cookie_duration?: number;       // seconds
  cookie_policy?: string;
  category?: string;
  sub_category?: string;
  type?: number;
  start_time?: string;            // ISO
  end_time?: string | null;
  description?: {                 // HTML lồng — KHÔNG strip ở client, lưu raw vào atRawData
    action_point?: string;
    commission_policy?: string;
    cookie_policy?: string;
    introduction?: string;
    other_notice?: string;
    rejected_reason?: string;
    traffic_building_policy?: string;
  };
}

interface CampaignListResponse {
  data: AccesstradeCampaign[];
  total?: number;
}

async fetchCampaigns(opts: {
  approval?: "successful" | "pending" | "unregistered";
  page?: number;
  limit?: number;
} = {}): Promise<AccesstradeCampaign[]> {
  if (!this.isConfigured()) {
    this.logger.warn("Accesstrade not configured — skipping campaigns fetch");
    return [];
  }
  const base = process.env.ACCESSTRADE_API_BASE ?? "https://api.accesstrade.vn/v1";
  const params = new URLSearchParams();
  if (opts.approval) params.set("approval", opts.approval);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const url = `${base}/campaigns?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Token ${process.env.ACCESSTRADE_ACCESS_TOKEN}`,
        Accept: "application/json"
      }
    });
    if (!resp.ok) {
      const body = await resp.text();
      this.logger.error(`Accesstrade /campaigns ${resp.status}: ${body.slice(0, 300)}`);
      return [];
    }
    const json = (await resp.json()) as CampaignListResponse;
    return Array.isArray(json.data) ? json.data : [];
  } catch (error: unknown) {
    this.logger.error("Accesstrade fetchCampaigns failed", error instanceof Error ? error.message : String(error));
    return [];
  }
}
```

**Lưu ý pattern**: giống `fetchProducts` — try/catch, log + return `[]` khi fail. Không throw lên.

### AC2 — Service mới `CampaignSyncService`

File mới: `apps/api/src/modules/crawler/campaign-sync.service.ts`

```ts
import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient } from "./clients/accesstrade.client";

export interface CampaignSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
}

@Injectable()
export class CampaignSyncService {
  private readonly logger = new Logger(CampaignSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  /**
   * Sync tất cả approved campaigns từ AT về DB.
   * - Upsert theo atCampaignId (unique).
   * - Tự động fill atCategoryName, atLogo, ... từ response.
   * - KHÔNG đụng vào categoryId (admin assign sau ở STORY-04).
   * - KHÔNG đụng vào filterRules (admin set sau).
   * - KHÔNG đụng vào notes, commissionNote (admin gõ tay).
   */
  async syncFromAccesstrade(): Promise<CampaignSyncResult> {
    const all = await this.fetchAllPages();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const c of all) {
      if (!c.id || !c.name) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.campaign.findUnique({
        where: { atCampaignId: c.id }
      });

      const baseFields = {
        atCampaignId: c.id,
        name: c.name,
        merchantName: c.merchant,
        atCategoryName: c.category ?? null,
        atSubCategory: c.sub_category ?? null,
        atLogo: c.logo ?? null,
        atMerchantUrl: c.url ?? null,
        atScope: c.scope ?? null,
        atCookieDurationSec: c.cookie_duration ?? null,
        atStartTime: c.start_time ? new Date(c.start_time) : null,
        atEndTime: c.end_time ? new Date(c.end_time) : null,
        atRawData: c as unknown as Prisma.InputJsonValue,
        atLastSyncedAt: new Date()
      };

      if (existing) {
        // Update: refresh các field từ AT, GIỮ NGUYÊN categoryId, filterRules, notes, status admin set
        await this.prisma.campaign.update({
          where: { id: existing.id },
          data: baseFields
        });
        updated += 1;
      } else {
        await this.prisma.campaign.create({
          data: {
            ...baseFields,
            network: AffiliateNetwork.ACCESSTRADE,
            externalId: c.id,            // dùng atCampaignId làm externalId cho campaign mới
            status: c.approval === "successful" ? "APPROVED" : "APPLIED",
            approvedAt: c.approval === "successful" ? new Date() : null
          }
        });
        created += 1;
      }
    }

    this.logger.log(`Sync campaigns: ${created} created, ${updated} updated, ${skipped} skipped, ${all.length} total`);
    return { fetched: all.length, created, updated, skipped };
  }

  private async fetchAllPages(): Promise<Array<Awaited<ReturnType<AccesstradeClient["fetchCampaigns"]>>[number]>> {
    const all = [];
    const PAGE_SIZE = 50;
    let page = 1;
    while (page < 50) {  // safety cap
      const batch = await this.accesstrade.fetchCampaigns({
        approval: "successful",
        page,
        limit: PAGE_SIZE
      });
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page += 1;
    }
    return all;
  }
}
```

### AC3 — Đăng ký service trong module

File: [apps/api/src/modules/crawler/crawler.module.ts](../../../../apps/api/src/modules/crawler/crawler.module.ts)

Thêm `CampaignSyncService` vào `providers` + `exports`.

### AC4 — Admin endpoint trigger sync

File: [apps/api/src/modules/admin/admin.controller.ts](../../../../apps/api/src/modules/admin/admin.controller.ts)

Thêm method:

```ts
@Post("campaigns/sync-from-at")
async syncCampaignsFromAt(
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["admin"]);
  return this.campaignSync.syncFromAccesstrade();
}
```

Inject `CampaignSyncService` vào constructor.

**Lưu ý**:
- Theo convention [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md), admin endpoint dùng `this.authorize(role, apiKey, allowedRoles)`, không phải guard.
- Endpoint này chỉ `admin` role được dùng (sync là operation nặng + đụng data quan trọng).
- Không cần zod schema body vì không nhận body.

### AC5 — Server action + UI button bên web

File: [apps/web/app/admin/actions.ts](../../../../apps/web/app/admin/actions.ts) (hoặc file actions tương ứng cho campaigns)

Thêm server action:

```ts
"use server";

export async function syncCampaignsFromAccesstrade() {
  const res = await fetch(`${process.env.API_BASE}/admin/campaigns/sync-from-at`, {
    method: "POST",
    headers: {
      "x-admin-role": "admin",
      "x-admin-key": process.env.ADMIN_API_KEY ?? ""
    },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Sync failed: ${res.status}`);
  }
  revalidatePath("/admin/campaigns");
  return res.json() as Promise<{ fetched: number; created: number; updated: number; skipped: number }>;
}
```

Tham khảo pattern các server action khác trong [actions.ts](../../../../apps/web/app/admin/actions.ts) để giữ nhất quán (đặc biệt phần `revalidatePath`).

File: [apps/web/app/admin/campaigns/page.tsx](../../../../apps/web/app/admin/campaigns/page.tsx)

Thêm nút "Sync from Accesstrade" ở header của ListPageShell. Gọi server action khi bấm. Hiển thị toast thành công với `{created, updated}`.

Tham khảo convention `ListPageShell + FormDialog + RowActions` (xem [apps/web/components/admin/ui/index.ts](../../../../apps/web/components/admin/ui/index.ts) — đây là convention của memory `project_admin_ui_conventions.md`).

### AC6 — Toast + revalidate

Sau khi sync thành công:
- Toast: "Synced X campaigns (Y created, Z updated)".
- Tự refresh table (revalidatePath đã làm).

Sau khi sync fail:
- Toast error với message từ API (vd "Accesstrade not configured" nếu thiếu env).

### AC7 — Test smoke

- Thiết lập `ACCESSTRADE_ACCESS_TOKEN` trong `apps/api/.env` với token thật.
- Vào `/admin/campaigns` → bấm "Sync from Accesstrade" → đợi → table refresh thấy campaigns mới.
- Mở pgAdmin → xem table `Campaign` → verify field `atCampaignId`, `atLogo`, `atRawData` được fill.

### AC8 — Unit test

File mới: `apps/api/src/modules/crawler/campaign-sync.service.spec.ts`

Theo chuẩn `mt-dev` section 2.2 (test bắt buộc khi thêm service mới). Cover tối thiểu:

- `syncFromAccesstrade()` với mock `AccesstradeClient.fetchCampaigns()` → `{created: N, updated: 0, skipped: 0}` cho lần đầu.
- Chạy lần 2 với cùng mock → `{created: 0, updated: N, skipped: 0}` (idempotent theo `atCampaignId`).
- Update KHÔNG ghi đè `categoryId`, `filterRules`, `notes` (set sẵn trong DB trước test).
- Item thiếu `id` hoặc `name` → counted vào `skipped`.
- Mock pagination: trả 50 → 50 → 12 → break (verify `fetchAllPages` stop khi batch < PAGE_SIZE).

Pattern: `describe(CampaignSyncService) > describe(syncFromAccesstrade) > it("...")`. Inject mock Prisma via `Test.createTestingModule()`.

## Technical breakdown

### Files mới
- `apps/api/src/modules/crawler/campaign-sync.service.ts` — service chính.

### Files sửa
- `apps/api/src/modules/crawler/clients/accesstrade.client.ts` — thêm `fetchCampaigns` + interface.
- `apps/api/src/modules/crawler/crawler.module.ts` — register service.
- `apps/api/src/modules/admin/admin.controller.ts` — thêm endpoint + inject service.
- `apps/web/app/admin/actions.ts` (hoặc file tương ứng) — server action.
- `apps/web/app/admin/campaigns/page.tsx` — UI button.
- `apps/web/app/admin/campaigns/campaigns-table.tsx` — nếu có cột mới muốn show (vd logo, scope, atLastSyncedAt).

### Schema
- Không cần migration mới (STORY-01 đã thêm field).

### Env
- Không thêm env mới.

## API contract

**`POST /api/v1/admin/campaigns/sync-from-at`**

Headers:
- `x-admin-role: admin`
- `x-admin-key: <ADMIN_API_KEY>`

Body: không.

Response 200:
```json
{
  "fetched": 50,
  "created": 12,
  "updated": 38,
  "skipped": 0
}
```

Response 401: token sai.
Response 403: role không phải admin.
Response 500: lỗi server (vd AT API down) — log chi tiết server-side.

## Definition of Done

- [ ] `AccesstradeClient.fetchCampaigns()` có thể test isolated: gọi từ unit test với mock fetch trả AT shape, parse đúng `data[]`.
- [ ] `CampaignSyncService.syncFromAccesstrade()` upsert đúng theo `atCampaignId` unique.
- [ ] Chạy lần 2 không tạo duplicate (idempotent).
- [ ] Update campaign cũ KHÔNG đụng vào `categoryId`, `filterRules`, `notes` (admin-managed).
- [ ] Admin endpoint trả 401 với key sai, 200 với key đúng.
- [ ] UI button "Sync from Accesstrade" hoạt động, table refresh.
- [ ] Verify trong pgAdmin field mới fill đầy đủ.
- [ ] `campaign-sync.service.spec.ts` pass — cover idempotent, không ghi đè admin-managed fields, pagination stop, skip invalid items.
- [ ] `npm run test:api` pass.
- [ ] Doc [docs/integrations/accesstrade.md](../../../integrations/accesstrade.md) đánh dấu mục 3.2 từ "(chưa dùng)" → "(đang dùng)".

## Out of scope

- **Auto-cron sync**: chỉ manual trigger ở story này. Có thể add cron sau (vd hằng ngày) nhưng không phải bây giờ.
- **Sync campaign trạng thái khác** (`pending`, `unregistered`): chỉ pull `successful` (campaign approved). Admin tự apply pending campaigns trên AT dashboard, không quản trên hệ thống ta.
- **Strip HTML trong `description`**: lưu raw, hiển thị HTML khi cần (STORY-04 có thể hiển thị `introduction` HTML trong dialog assign). Không strip ở backend.
- **Backfill atCampaignId cho campaign legacy** (externalId là slug): không tự động. Admin chạy sync sẽ tạo row mới với atCampaignId; admin tự merge legacy → new qua /admin/campaigns hoặc qua SQL tay (note trong MIGRATION-NOTES.md).
- **Pagination UI**: nếu có 200+ campaign, sync trả all một lần OK. UI list `/admin/campaigns` đã có pagination sẵn.

## Notes cho AI agent

- **Pattern fetch + log fail**: copy exactly từ `fetchProducts` (cùng file). Đừng thêm retry custom — STORY chưa yêu cầu.
- **Auth header format**: `Authorization: Token <key>` (có dấu cách), không phải `Bearer`. Doc [accesstrade.md mục 1](../../../integrations/accesstrade.md#1-authentication).
- **Convention zod ở admin endpoint**: không cần zod nếu không có body (endpoint này không nhận body).
- **Convention server action**: file [actions.ts](../../../../apps/web/app/admin/actions.ts) đã có nhiều example. Tuyệt đối không gọi Prisma trực tiếp từ server action — phải qua HTTP đến api.
- **Toast lib**: kiểm tra [apps/web/components/admin/ui/](../../../../apps/web/components/admin/ui/) xem dùng lib gì (shadcn/sonner...). Match.
- **`atLastSyncedAt`** rất hữu ích cho debug — nếu sau vài tuần thấy 1 campaign không update, biết là AT đã remove khỏi danh sách approved.
- **Don't infer status sai**: doc AT trả `status: 1` (number) = Running. Field `Campaign.status` của ta là enum `APPLIED|APPROVED|PAUSED|REJECTED|INACTIVE`. Chỉ map `approval=successful` → `APPROVED`, không map field `status` của AT.
