# STORY-08 — Link ngoài site (Loop 5): TrackedLink generator + AT product_link/create

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 4h
**Money loop:** Loop 5 — "Đẩy link tracked ra ngoài site"
**Dependencies:** STORY-03 (placeholder widget chỗ mount KPI).

## Context

**Vấn đề**: Operator có FB cá nhân + Zalo group + Tiktok cá nhân nhưng chỉ kiếm tiền trên dealvault.vn organic traffic. Bỏ phí ngoài-site audience.

**Giải pháp**: AT có `POST /v1/product_link/create` — tạo tracking link cho **URL bất kỳ** (không cần URL nằm trong datafeed). Support UTM tuỳ chỉnh (sub1-4).

**Flow**:
1. Operator paste URL Lazada/Shopee bất kỳ (vd: link 1 product hot trên Lazada landing page mà chưa có trong feed).
2. Chọn channel (FB/Zalo/Email/Other).
3. Add nội bộ note (optional, vd "post FB sale 5.5").
4. Submit → backend POST `/v1/product_link/create` → AT trả `aff_link` + `short_link`.
5. Save vào `TrackedLink` table.
6. Display short_link + QR code + click counter.
7. Operator copy short_link → post FB/Zalo.
8. Khi user click short_link → AT redirect tới merchant → revenue carry attribution qua `sub1=<channel>`.

**Lưu ý**: short_link AT đã track click ở AT side. Ta KHÔNG cần thêm tracking nội bộ (ko qua ClickLog). Click count display lấy từ AT `/v1/transactions` filter `utm_campaign=<our-link-id>` hoặc đơn giản hơn: lưu local counter via increment khi short_link redirect qua proxy nội bộ (nếu cần independent count).

**Pick**: simplest path — không proxy, trust AT click counting. Operator có thể xem count qua AT dashboard, dealvault chỉ list link + revenue attribution từ reconcile.

## User story

> **As** operator có audience nhỏ FB cá nhân (500 friend) hoặc Zalo group (100 member),
> **I want** 1 form paste URL → trả về tracking short link đẹp + QR code copy 1 click,
> **so that** tôi post lên cá nhân page kiếm thêm vài đơn/tuần không tốn ad budget.

## Acceptance criteria

### AC1 — Schema: TrackedLink model

`apps/api/prisma/schema.prisma`:

```prisma
model TrackedLink {
  id              String   @id @default(uuid()) @db.Uuid
  title           String                              // operator-readable, e.g. "Robot Roborock S7 FB post 23/5"
  originUrl       String   @db.Text                   // URL gốc operator paste
  atCampaignId    String                              // chọn campaign cho POST product_link/create
  atAffLink       String   @db.Text                   // aff_link trả về từ AT
  atShortLink     String                              // short_link từ AT (vd shorten.dev.accesstrade.me/X)
  channel         String                              // "fb" | "zalo" | "email" | "tiktok" | "other"
  sub1            String?                             // = channel (denormalize)
  sub2            String?
  sub3            String?
  sub4            String?
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?
  utmContent      String?
  notes           String?  @db.Text
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  createdBy       String?                             // admin role/email (audit)
  // Stats (optional — populate via reconcile match)
  clickCount      Int      @default(0)
  conversionCount Int      @default(0)
  revenue         Float    @default(0)
  lastConversionAt DateTime?

  @@index([channel])
  @@index([createdAt])
  @@index([atCampaignId])
}
```

Migration: `npm run db:migrate -- --name add_tracked_links`.

### AC2 — Extend AccesstradeClient

File: `apps/api/src/modules/crawler/clients/accesstrade.client.ts`.

```ts
async createProductLink(opts: {
  campaignId: string;
  urls?: string[];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  urlEnc?: boolean;
}): Promise<ProductLinkCreateResponse> {
  const body: Record<string, unknown> = {
    campaign_id: opts.campaignId,
    ...(opts.urls && { urls: opts.urls }),
    ...(opts.utmSource && { utm_source: opts.utmSource }),
    ...(opts.utmMedium && { utm_medium: opts.utmMedium }),
    ...(opts.utmCampaign && { utm_campaign: opts.utmCampaign }),
    ...(opts.utmContent && { utm_content: opts.utmContent }),
    ...(opts.sub1 && { sub1: opts.sub1 }),
    ...(opts.sub2 && { sub2: opts.sub2 }),
    ...(opts.sub3 && { sub3: opts.sub3 }),
    ...(opts.sub4 && { sub4: opts.sub4 }),
    url_enc: opts.urlEnc ?? true
  };
  const res = await this.httpClient.post("/v1/product_link/create", body);
  return res.data; // shape doc mục 3.4
}
```

DTO `ProductLinkCreateResponse`:
```ts
export interface ProductLinkCreateResponse {
  success: boolean;
  data: {
    success_link: Array<{
      aff_link: string;
      first_link: string | null;
      short_link: string;
      url_origin: string;
    }>;
    error_link: Array<{ url: string; error: string }>;
    suspend_url: string[];
  };
}
```

### AC3 — TrackedLinkService

NEW: `apps/api/src/modules/insights/tracked-link.service.ts`.

```ts
@Injectable()
export class TrackedLinkService {
  constructor(private prisma: PrismaService, private accesstrade: AccesstradeClient) {}

  async create(input: CreateTrackedLinkInput): Promise<TrackedLink> {
    // Auto-detect campaign từ domain URL nếu chưa specify
    let campaignId = input.atCampaignId;
    if (!campaignId) {
      const detected = await this.detectCampaignFromUrl(input.originUrl);
      if (!detected) throw new HttpException("Cannot auto-detect campaign from URL — specify atCampaignId", HttpStatus.BAD_REQUEST);
      campaignId = detected.atCampaignId;
    }

    // Call AT
    const res = await this.accesstrade.createProductLink({
      campaignId,
      urls: [input.originUrl],
      sub1: input.channel,
      utmSource: input.utmSource ?? "external_post",
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
      urlEnc: true
    });

    if (!res.data?.success_link?.length) {
      const errors = res.data?.error_link?.map(e => e.error).join(", ") ?? "unknown";
      throw new HttpException(`AT create link failed: ${errors}`, HttpStatus.BAD_REQUEST);
    }

    const linkData = res.data.success_link[0];

    return this.prisma.trackedLink.create({
      data: {
        title: input.title,
        originUrl: input.originUrl,
        atCampaignId: campaignId,
        atAffLink: linkData.aff_link,
        atShortLink: linkData.short_link,
        channel: input.channel,
        sub1: input.channel,
        sub2: input.sub2,
        sub3: input.sub3,
        sub4: input.sub4,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
        notes: input.notes,
        createdBy: input.createdBy
      }
    });
  }

  private async detectCampaignFromUrl(url: string): Promise<Campaign | null> {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    // Map host → merchant slug
    const merchantMap: Record<string, string> = {
      "lazada.vn": "lazada_kol",
      "shopee.vn": "shopee",
      "tiki.vn": "tiki",
      "nguyenkim.com": "nguyenkimvn",
      "tiktok.com": "tiktok_cps"
    };
    const merchantSlug = Object.entries(merchantMap).find(([h]) => host.includes(h))?.[1];
    if (!merchantSlug) return null;
    return this.prisma.campaign.findFirst({
      where: { merchantName: merchantSlug, status: "APPROVED", atCampaignId: { not: null } }
    });
  }

  async list(opts: { channel?: string; limit?: number; offset?: number }) {
    return this.prisma.trackedLink.findMany({
      where: opts.channel ? { channel: opts.channel } : undefined,
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0
    });
  }

  async getKpi(opts: { days?: number }) {
    const days = opts.days ?? 7;
    const since = new Date(Date.now() - days * 86400000);
    const links = await this.prisma.trackedLink.findMany({
      where: { createdAt: { gte: since }, isActive: true }
    });
    return {
      totalLinks: links.length,
      activeLinks: links.filter(l => l.isActive).length,
      totalClicks: links.reduce((s, l) => s + l.clickCount, 0),
      totalConversions: links.reduce((s, l) => s + l.conversionCount, 0),
      totalRevenue: links.reduce((s, l) => s + l.revenue, 0),
      byChannel: groupByChannel(links)
    };
  }

  async updateStats(linkId: string, delta: { clicks?: number; conversions?: number; revenue?: number; lastConversionAt?: Date }) {
    // Helper for reconciler to update when matched
    return this.prisma.trackedLink.update({
      where: { id: linkId },
      data: {
        clickCount: delta.clicks ? { increment: delta.clicks } : undefined,
        conversionCount: delta.conversions ? { increment: delta.conversions } : undefined,
        revenue: delta.revenue ? { increment: delta.revenue } : undefined,
        lastConversionAt: delta.lastConversionAt
      }
    });
  }
}
```

### AC4 — Admin endpoints

```ts
// POST /admin/tracked-links
@Post("tracked-links")
async createTrackedLink(@Body() body, ...auth) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);
  const parsed = createTrackedLinkSchema.parse(body); // zod
  return this.trackedLinkService.create({ ...parsed, createdBy: role });
}

// GET /admin/tracked-links
@Get("tracked-links")
async listTrackedLinks(@Query() query, ...auth) {
  this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
  return this.trackedLinkService.list({
    channel: query.channel,
    limit: query.limit ? parseInt(query.limit) : 50,
    offset: query.offset ? parseInt(query.offset) : 0
  });
}

// GET /admin/tracked-links/kpi
@Get("tracked-links/kpi")
async getTrackedLinkKpi(@Query("days") days?: string, ...auth) {
  this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
  return this.trackedLinkService.getKpi({ days: days ? parseInt(days) : 7 });
}

// PATCH /admin/tracked-links/:id
@Put("tracked-links/:id")
async updateTrackedLink(@Param("id") id: string, @Body() body, ...auth) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);
  const parsed = updateTrackedLinkSchema.parse(body);
  return this.prisma.trackedLink.update({ where: { id }, data: parsed });
}

// DELETE /admin/tracked-links/:id
@Delete("tracked-links/:id")
async deleteTrackedLink(@Param("id") id: string, ...auth) {
  this.authorize(role, apiKey, ["admin"]);
  // Soft delete — set isActive false
  return this.prisma.trackedLink.update({ where: { id }, data: { isActive: false } });
}
```

### AC5 — Conversion attribution → update TrackedLink stats

Khi reconciler match conversion với trackingCode → ALSO check nếu utm_campaign hoặc utm_content match `TrackedLink.utmCampaign/utmContent` → increment stats.

Tốt nhất: dùng `sub2` để carry `trackedLinkId` khi AT generate link. Update `createProductLink` call:

```ts
const res = await this.accesstrade.createProductLink({
  campaignId,
  urls: [input.originUrl],
  sub1: input.channel,
  sub2: `tl_${generatedId}`,  // pre-generate UUID, save to TrackedLink.id sau
  ...
});
```

Khi reconciler đọc `/v1/transactions._extra.parameters.sub2` → nếu match `tl_<uuid>` → lookup TrackedLink + increment stats.

**Pragmatic alternative**: defer click counting, chỉ track conversion → revenue. AT short_link tự count click ở AT dashboard. Operator có thể xem dashboard AT để biết click. Dealvault chỉ tập trung conversion attribution.

### AC6 — Admin UI: External Links page

NEW page: `apps/web/app/admin/external-links/page.tsx`.

Layout:

```
┌─────────────────────────────────────────────────────┐
│ 🔗 Link ngoài site                                 │
│ Tạo link tracked cho URL bất kỳ — post FB, Zalo,   │
│ TikTok cá nhân → kiếm thêm.                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ TẠO LINK MỚI                                        │
│                                                     │
│ URL gốc (Lazada/Shopee/Tiki/...): *                 │
│ [https://www.lazada.vn/products/robot-roborock-...]│
│                                                     │
│ Kênh đăng: *                                        │
│ ( ) FB cá nhân  ( ) Zalo  ( ) Email  ( ) Tiktok    │
│ ( ) Khác: [____________]                            │
│                                                     │
│ Tên (để bạn nhớ): *                                 │
│ [Robot Roborock S7 - FB sale 5.5]                  │
│                                                     │
│ Ghi chú (tuỳ chọn):                                 │
│ [...]                                               │
│                                                     │
│ [Tạo link tracked →]                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ KPI 7 NGÀY                                          │
│ • 23 link active                                    │
│ • 450 click (theo AT dashboard)                     │
│ • 12 đơn ghi nhận                                   │
│ • 380k VND revenue                                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ LINK ĐÃ TẠO                                         │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ Robot Roborock S7 - FB sale 5.5                 ││
│ │ Kênh: FB cá nhân • Tạo 23/5 14:32               ││
│ │ Short: shorten.../abc123  [Copy] [QR]            ││
│ │ Stats: 0 đơn, 0 VND (chưa có data)              ││
│ │ [Xem AT dashboard] [Tắt link]                   ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ ... (more links)                                ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

Form là client component, submit via server action.

### AC7 — Copy + QR code

NEW: `apps/web/components/admin/external-links/copy-and-qr.tsx` (client).

```tsx
"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  shortLink: string;
}

export function CopyAndQR({ shortLink }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(shortLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-canvas px-2 py-1 text-xs">{shortLink}</code>
      <button onClick={copy} className="rounded border border-line px-2 py-1 text-xs hover:bg-card-soft">
        {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />} Copy
      </button>
      <button onClick={() => setShowQR(true)} className="rounded border border-line px-2 py-1 text-xs hover:bg-card-soft">
        QR
      </button>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowQR(false)}>
          <div className="rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={`/api/admin/qr?text=${encodeURIComponent(shortLink)}`} alt="QR" className="size-64" />
            <p className="mt-3 text-center text-xs text-ink-soft">{shortLink}</p>
            <button onClick={() => setShowQR(false)} className="mt-3 w-full rounded-md bg-brand-600 px-3 py-2 text-sm text-white">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

QR generation endpoint:
NEW: `apps/web/app/api/admin/qr/route.ts`:

```ts
import QRCode from "qrcode"; // npm install qrcode (small dep)

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text");
  if (!text) return new Response("Missing text", { status: 400 });
  const png = await QRCode.toBuffer(text, { width: 256, margin: 2 });
  return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
```

### AC8 — Admin widget: External Link KPI (replace STORY-03 placeholder)

NEW: `apps/web/components/admin/dashboard/external-link-kpi-widget.tsx`.

```tsx
import { adminFetch } from "../ui/admin-fetch";
import Link from "next/link";

interface Kpi {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  byChannel: Record<string, { links: number; revenue: number }>;
}

export async function ExternalLinkKPIWidget() {
  const kpi = await adminFetch<Kpi>("/admin/tracked-links/kpi?days=7", "GET");

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">🔗 Link ngoài site (7 ngày)</h3>
        <Link href="/admin/external-links" className="text-xs text-brand-700 hover:underline">Quản lý →</Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-ink-mute">Active</p>
          <p className="text-lg font-bold text-ink">{kpi.activeLinks}</p>
        </div>
        <div>
          <p className="text-xs text-ink-mute">Đơn ghi nhận</p>
          <p className="text-lg font-bold text-ink">{kpi.totalConversions}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-ink-mute">Revenue tuần</p>
          <p className="text-xl font-bold text-emerald-700">{formatMoney(kpi.totalRevenue)}</p>
        </div>
      </div>

      <Link
        href="/admin/external-links/new"
        className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        + Tạo link mới
      </Link>
    </div>
  );
}
```

### AC9 — Edge: AT fail / suspend URL

Nếu `error_link` hoặc `suspend_url` không rỗng:
- Show error message rõ trong form result: "URL bị Accesstrade chặn (merchant không cho deep-link). Vui lòng dùng URL khác."
- Operator có thể retry với URL khác.

Nếu `success_link` rỗng và `error_link` cũng rỗng (lỗi unexpected):
- Show generic error + log full response.

### AC10 — Sidebar mount

STORY-03 đã propose menu "Tiền & Hiệu suất → Link ngoài site → /admin/external-links". Verify mount đúng.

## Files touched

```
apps/api/prisma/schema.prisma                                   (add TrackedLink model)
apps/api/prisma/migrations/<ts>_add_tracked_links/              (NEW)
apps/api/src/modules/crawler/clients/accesstrade.client.ts      (add createProductLink)
apps/api/src/modules/insights/tracked-link.service.ts           (NEW)
apps/api/src/modules/admin/admin.controller.ts                  (5 endpoint TrackedLink CRUD + KPI)
apps/web/app/admin/external-links/page.tsx                      (NEW list + form)
apps/web/app/admin/external-links/new/page.tsx                  (NEW create form)
apps/web/app/admin/external-links/actions.ts                    (server actions)
apps/web/components/admin/external-links/copy-and-qr.tsx        (NEW client)
apps/web/components/admin/dashboard/external-link-kpi-widget.tsx (replace STORY-03 placeholder)
apps/web/app/api/admin/qr/route.ts                              (NEW QR generator)
apps/web/app/api/admin/tracked-links/...                        (proxy routes)
package.json (apps/web)                                          (add "qrcode" dep ~50KB)
```

## Verification

```bash
# 1. Migration
npm run db:migrate -- --name add_tracked_links

# 2. Create link via API
curl -X POST http://localhost:4000/api/v1/admin/tracked-links \
  -H "Content-Type: application/json" -H "x-admin-role: admin" -H "x-admin-key: $KEY" \
  -d '{"title":"Test","originUrl":"https://www.lazada.vn/products/robot-1.html","channel":"fb"}'
# expect: 200/201 with atShortLink populated

# 3. Auto-detect campaign
# URL lazada.vn → campaign auto-detect = lazada_kol
# URL unknown domain → return 400 "specify atCampaignId"

# 4. List
curl http://localhost:4000/api/v1/admin/tracked-links -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: array

# 5. KPI
curl http://localhost:4000/api/v1/admin/tracked-links/kpi?days=7 -H "..." 
# expect: { totalLinks, activeLinks, totalConversions, totalRevenue, byChannel }

# 6. Admin UI
# Open /admin/external-links → form + list
# Submit form → link created → row visible
# Click Copy → clipboard contains short_link
# Click QR → modal shows QR image
# Scan QR → open short_link → redirect to merchant

# 7. Suspend URL handling
# Submit URL of suspend_url (rare) → form shows error message

# 8. Widget on dashboard
# Open /admin → ExternalLinkKPIWidget shows real stats
```

## Definition of done

- [ ] `TrackedLink` migrated.
- [ ] `createProductLink` AT method work.
- [ ] Auto-detect campaign from URL domain.
- [ ] Admin form create link, save aff_link + short_link.
- [ ] Copy button works, QR code generates.
- [ ] List page with stats + edit/delete.
- [ ] KPI widget replace STORY-03 placeholder với data thật.
- [ ] Suspend URL + error_link handled gracefully.
- [ ] `qrcode` npm dep installed.

## Notes for next session

- Conversion attribution → TrackedLink: STORY-06 sub-IDs đã carry channel attribution. Cần thêm sub2 = TrackedLink id để link conversion ngược về.
- Click count: AT counts ở dashboard AT. Dealvault có thể proxy short_link qua `/r/<short_id>` để increment local counter — defer.
- QR code library: cân nhắc `qrcode` (Node) hoặc thay bằng `next/og` generate inline.
- URL detect mapping (`merchantMap`) hard-coded — extend khi operator onboard merchant mới.
- Operator có thể bulk create: paste 10 URL → tạo 10 link cùng lúc. Defer feature.
- Link analytics deep dive: per-link funnel (impression → click → conversion). Defer.
- Sprint sau có thể automate: auto-create TrackedLink khi article publish (cho mỗi product cited trong article).
