# STORY-06 — Sub-IDs channel attribution (Loop 3): Money Trail "Theo kênh"

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 5h
**Money loop:** Loop 3 — "Kênh nào sinh tiền? Đầu tư đúng kênh."
**Dependencies:** STORY-02 (reconcile wired LastSyncStatus). STORY-03 (placeholder widget).

## Context

**Vấn đề**: Hiện tại tracking action gắn `?utm_source=<trackingCode>` (32-char uuid) — match được order với click cụ thể, NHƯNG **ko biết click đến từ kênh nào** (organic SEO, FB ad, Zalo, email, direct).

Operator chạy FB ad nhưng ko biết kênh nào convert tốt → ko optimize bid được.

**Giải pháp**: AT hỗ trợ **`sub1, sub2, sub3, sub4`** params trong aff_link. Thêm `sub1=<channel>` mỗi click → AT carry attribution qua → reconciler đọc lại từ `/v1/transactions._extra.parameters.sub1` (theo doc mục 3.5).

**Channel detection logic**:
- Cookie `utm_source` từ URL landing → "fb" (nếu `?utm_source=fb`), "zalo", "email", etc.
- HTTP referer fallback nếu cookie ko có:
  - `facebook.com` → "fb"
  - `zalo.me`, `chat.zalo.me` → "zalo"
  - Google domains → "organic"
  - Direct (no referer) → "direct"
- Cookie persist 30 ngày — first-touch attribution.

**Operator surface**:
- Money Trail tab "Theo kênh" — bảng `[Kênh] | Click | Đơn | Revenue | Chi (operator nhập tay) | ROAS`.
- Operator nhập ad spend hàng tuần (manual form) → admin tự tính ROAS.
- Insight: "FB ROAS 0.8 → giảm. Zalo ROAS 4.2 → tăng."

## User story

> **As** operator chạy FB ad + post Zalo nhưng ko có team analytics,
> **I want** thấy 1 bảng đơn giản "Kênh nào sinh tiền hiệu quả nhất tuần này",
> **so that** tôi biết rót ngân sách đúng chỗ thay vì đốt FB ad không tracking.

## Acceptance criteria

### AC1 — Schema: ClickLog + AdSpend

`apps/api/prisma/schema.prisma`:

Extend `ClickLog`:
```prisma
model ClickLog {
  // ... existing ...
  channel         String?  @default("direct")     // "organic" | "fb" | "zalo" | "email" | "direct" | other
  subId1          String?                          // = channel (denormalize for query)
  subId2          String?                          // future use (e.g. campaign id internal)
  attributionSource String?                        // detection method: "utm_param" | "referer" | "cookie" | "default"

  @@index([channel])
  @@index([createdAt, channel])
}
```

NEW `AdSpend` model — operator nhập ad spend weekly:
```prisma
model AdSpend {
  id              String   @id @default(uuid()) @db.Uuid
  channel         String                            // "fb" | "zalo" | "email" | "other"
  weekStartDate   DateTime @db.Date                 // Monday VN time
  amount          Int                               // VND
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([channel, weekStartDate])
  @@index([weekStartDate])
}
```

Migration: `npm run db:migrate -- --name add_channel_attribution_adspend`.

### AC2 — Channel detection helper

NEW: `apps/web/lib/channel-detect.ts`.

```ts
import { headers } from "next/headers";

const FB_DOMAINS = /facebook|fb\.me|instagram/i;
const ZALO_DOMAINS = /zalo\.me|chat\.zalo/i;
const GOOGLE_DOMAINS = /google\.|googleusercontent|googleadservices/i;
const SEARCH_ENGINES = /bing\.|yahoo\.|duckduckgo|cốc cốc|coccoc/i;

export type Channel = "organic" | "fb" | "zalo" | "email" | "direct" | "other";

export interface ChannelDetection {
  channel: Channel;
  source: "utm_param" | "referer" | "cookie" | "default";
}

/**
 * Detect channel theo priority:
 * 1. utm_source query param (highest priority)
 * 2. Cookie `dv_channel` (first-touch persisted 30 ngày)
 * 3. HTTP Referer header
 * 4. Default "direct"
 */
export async function detectChannel(opts: {
  utmSource?: string;
  cookieValue?: string;
}): Promise<ChannelDetection> {
  // 1. utm_source explicit
  if (opts.utmSource) {
    const utm = opts.utmSource.toLowerCase();
    if (utm === "fb" || utm === "facebook") return { channel: "fb", source: "utm_param" };
    if (utm === "zalo") return { channel: "zalo", source: "utm_param" };
    if (utm === "email" || utm === "newsletter" || utm === "digest") return { channel: "email", source: "utm_param" };
    if (utm === "organic" || utm === "seo") return { channel: "organic", source: "utm_param" };
  }

  // 2. Cookie first-touch
  if (opts.cookieValue && ["organic", "fb", "zalo", "email", "direct", "other"].includes(opts.cookieValue)) {
    return { channel: opts.cookieValue as Channel, source: "cookie" };
  }

  // 3. Referer
  try {
    const hdr = await headers();
    const referer = hdr.get("referer");
    if (referer) {
      const url = new URL(referer);
      const host = url.hostname.toLowerCase();
      if (FB_DOMAINS.test(host)) return { channel: "fb", source: "referer" };
      if (ZALO_DOMAINS.test(host)) return { channel: "zalo", source: "referer" };
      if (GOOGLE_DOMAINS.test(host) || SEARCH_ENGINES.test(host)) return { channel: "organic", source: "referer" };
      if (!host.includes("dealvault")) return { channel: "other", source: "referer" };
    }
  } catch { /* server context not available */ }

  return { channel: "direct", source: "default" };
}
```

### AC3 — Extend `createTrackingRedirect`

File: `apps/web/app/actions/tracking.ts`.

```ts
import { detectChannel } from "../../lib/channel-detect";
import { cookies } from "next/headers";

export async function createTrackingRedirect(input: TrackingInput): Promise<TrackingResult> {
  const trackingCode = randomUUID().replace(/-/g, "");

  // Detect channel
  const cookieStore = await cookies();
  const cookieChannel = cookieStore.get("dv_channel")?.value;
  const detection = await detectChannel({
    utmSource: undefined, // will read from URL if we pass it in — TODO
    cookieValue: cookieChannel
  });

  // Set cookie if not set (first-touch persist)
  if (!cookieChannel && detection.channel !== "direct") {
    cookieStore.set("dv_channel", detection.channel, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      sameSite: "lax",
      path: "/"
    });
  }

  try {
    const requestHeaders = await headers();
    // ... existing IP + UA extraction ...

    // POST tracking với channel info
    const response = await fetchWithTimeout(`${API_BASE_URL}/tracking/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: input.productId,
        trackingCode,
        ipAddress,
        userAgent,
        channel: detection.channel,        // NEW
        attributionSource: detection.source // NEW
      }),
      cache: "no-store"
    }, 4000);

    if (!response.ok) {
      // Fallback already documented in STORY-01 (vn-storefront-v2)
    }

    // Build affiliate URL với utm_source + sub1
    const parsedUrl = new URL(input.affiliateUrl);
    parsedUrl.searchParams.set("utm_source", trackingCode);
    parsedUrl.searchParams.set("sub1", detection.channel); // NEW

    return { trackingCode, finalUrl: parsedUrl.toString() };
  } catch (error) {
    // Fallback to direct redirect with sub1 still attached
    const parsedUrl = new URL(input.affiliateUrl);
    parsedUrl.searchParams.set("sub1", detection.channel);
    return { trackingCode: "", finalUrl: parsedUrl.toString() };
  }
}
```

### AC4 — TrackingController accept channel param

File: `apps/api/src/modules/tracking/tracking.controller.ts`.

DTO `CreateClickDto` extend:
```ts
export class CreateClickDto {
  // ... existing ...
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() attributionSource?: string;
}
```

Service save vào `ClickLog.channel` + `attributionSource`. Also set `subId1 = channel` (denormalize).

### AC5 — Reconciler đọc sub1 từ transactions

**Lưu ý**: `/v1/order-list` KHÔNG trả `_extra.parameters.sub1`. Phải dùng `/v1/transactions` để có `_extra` info.

Hiện tại reconciler dùng `/v1/order-list` cho match basic. Story này thêm 2 path:

**Path A (simple)**: trust client-side `ClickLog.channel` — đã set lúc click. Khi ConversionWebhook arrive với matching `trackingCode`, attribute conversion về channel đó.

**Path B (verify)**: cũng pull `/v1/transactions` để verify `_extra.parameters.sub1` match. Optional, defer if too expensive.

Pick **Path A** cho story này. Path B add sau nếu cần.

Implementation: khi `ConversionWebhook.trackingCode` match `ClickLog.trackingCode`, copy `clickLog.channel` vào `ConversionWebhook.channel` (NEW field).

Schema extension:
```prisma
model ConversionWebhook {
  // ... existing ...
  channel  String?  // attributed channel from ClickLog
  @@index([channel])
  @@index([createdAt, channel])
}
```

Migration: add to same migration as ClickLog (AC1).

Webhook controller update:
```ts
// Khi receive webhook + match ClickLog
const click = await this.prisma.clickLog.findUnique({ where: { trackingCode } });
const channel = click?.channel ?? "direct";
await this.prisma.conversionWebhook.create({
  data: {
    // ... existing ...
    channel
  }
});
```

### AC6 — MoneyTrailService — by-channel aggregation

NEW or extend: `apps/api/src/modules/insights/money-trail.service.ts`.

```ts
@Injectable()
export class MoneyTrailService {
  constructor(private prisma: PrismaService) {}

  async getByChannel(opts: { days?: number }) {
    const days = opts.days ?? 7;
    const since = new Date(Date.now() - days * 86400000);

    // Aggregate clicks + conversions per channel
    const clickAgg = await this.prisma.$queryRaw<Array<{ channel: string; clicks: number }>>`
      SELECT COALESCE(channel, 'direct') as channel, COUNT(*)::int as clicks
      FROM "ClickLog"
      WHERE "createdAt" >= ${since}
      GROUP BY channel
    `;

    const conversionAgg = await this.prisma.$queryRaw<Array<{ channel: string; orders: number; revenue: number }>>`
      SELECT COALESCE(channel, 'direct') as channel, COUNT(*)::int as orders, SUM(revenue)::float as revenue
      FROM "ConversionWebhook"
      WHERE "createdAt" >= ${since}
      GROUP BY channel
    `;

    // Ad spend
    const weekStart = new Date(Date.now() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) * 86400000);
    weekStart.setHours(0, 0, 0, 0);
    const adSpend = await this.prisma.adSpend.findMany({
      where: { weekStartDate: weekStart }
    });

    // Merge
    const allChannels = new Set([
      ...clickAgg.map(c => c.channel),
      ...conversionAgg.map(c => c.channel),
      ...adSpend.map(a => a.channel)
    ]);

    return Array.from(allChannels).map(channel => {
      const clicks = clickAgg.find(c => c.channel === channel)?.clicks ?? 0;
      const conv = conversionAgg.find(c => c.channel === channel);
      const orders = conv?.orders ?? 0;
      const revenue = conv?.revenue ?? 0;
      const spend = adSpend.find(a => a.channel === channel)?.amount ?? 0;
      const roas = spend > 0 ? revenue / spend : null;
      return { channel, clicks, orders, revenue, spend, roas };
    }).sort((a, b) => b.revenue - a.revenue);
  }
}
```

### AC7 — Admin endpoints

```ts
// GET money trail by channel
@Get("money-trail/channels")
async getMoneyTrailChannels(@Query("days") days?: string, ...auth) {
  this.authorize(...);
  return this.moneyTrail.getByChannel({ days: days ? parseInt(days) : 7 });
}

// CRUD ad spend
@Post("ad-spend")
async upsertAdSpend(@Body() body, ...auth) {
  this.authorize(...);
  const parsed = adSpendSchema.parse(body); // zod
  return this.prisma.adSpend.upsert({
    where: { channel_weekStartDate: { channel: parsed.channel, weekStartDate: parsed.weekStartDate } },
    create: parsed,
    update: { amount: parsed.amount, notes: parsed.notes }
  });
}

@Get("ad-spend")
async listAdSpend(@Query("weekStart") weekStart?: string, ...auth) {
  // ...
}
```

### AC8 — Admin UI: Channel ROAS widget (replace STORY-03 placeholder)

NEW: `apps/web/components/admin/dashboard/channel-roas-widget.tsx`.

```tsx
import { adminFetch } from "../ui/admin-fetch";
import Link from "next/link";

interface ChannelRow {
  channel: string;
  clicks: number;
  orders: number;
  revenue: number;
  spend: number;
  roas: number | null;
}

const LABELS: Record<string, string> = {
  organic: "SEO/Organic",
  fb: "Facebook",
  zalo: "Zalo",
  email: "Email",
  direct: "Direct",
  other: "Khác"
};

export async function ChannelROASWidget() {
  const data = await adminFetch<ChannelRow[]>("/admin/money-trail/channels?days=7", "GET");

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">💵 Tiền theo kênh (7 ngày)</h3>
        <Link href="/admin/money-trail" className="text-xs text-brand-700 hover:underline">Chi tiết →</Link>
      </div>

      <ul className="mt-3 space-y-2 text-sm">
        {data.map(row => (
          <li key={row.channel} className="flex items-center gap-2">
            <span className="w-20 text-xs text-ink-soft">{LABELS[row.channel] ?? row.channel}</span>
            <span className="flex-1 text-xs">
              {row.clicks} click → {row.orders} đơn → <span className="font-semibold text-emerald-700">{formatMoney(row.revenue)}</span>
            </span>
            {row.roas !== null && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                row.roas >= 2 ? "bg-emerald-100 text-emerald-700" :
                row.roas >= 1 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              }`}>
                ROAS {row.roas.toFixed(1)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <Link
        href="/admin/money-trail/ad-spend"
        className="mt-3 inline-block text-xs text-ink-soft hover:text-ink"
      >
        + Nhập chi phí quảng cáo tuần
      </Link>
    </div>
  );
}
```

### AC9 — Money Trail full page với tab "Theo kênh"

File: `apps/web/app/admin/money-trail/page.tsx` (verify path existing).

Add tab navigation:
- Tab 1: "Tổng quan" (existing money trail summary)
- Tab 2: "Theo kênh" (NEW)
- Tab 3: "Theo article" (placeholder for future)

Tab "Theo kênh" content:
- Full ChannelROAS table với column: Channel, Click, Đơn, Revenue, Chi, ROAS, Action (edit ad spend).
- "Nhập chi phí ad" form: select channel + week + amount.

### AC10 — Decay banner cho operator chưa nhập ad spend

Nếu có channel `fb` hoặc `zalo` có > 100 click trong tuần nhưng `AdSpend` chưa được set → banner nudge:

```
💡 Bạn có 234 click từ Facebook tuần này nhưng chưa nhập chi phí ad.
   [Nhập chi phí Facebook tuần →]
```

## Files touched

```
apps/api/prisma/schema.prisma                                   (extend ClickLog + ConversionWebhook + NEW AdSpend)
apps/api/prisma/migrations/<ts>_add_channel_attribution_adspend/ (NEW)
apps/api/src/modules/tracking/tracking.controller.ts            (accept channel + attributionSource)
apps/api/src/modules/tracking/dto/create-click.dto.ts           (extend DTO)
apps/api/src/modules/webhooks/webhooks.controller.ts            (copy channel từ ClickLog vào ConversionWebhook)
apps/api/src/modules/insights/money-trail.service.ts            (NEW or extend)
apps/api/src/modules/admin/admin.controller.ts                  (add money-trail/channels + ad-spend CRUD)
apps/web/app/actions/tracking.ts                                (channel detect + cookie + sub1 in URL)
apps/web/lib/channel-detect.ts                                  (NEW helper)
apps/web/components/admin/dashboard/channel-roas-widget.tsx     (replace STORY-03 placeholder)
apps/web/app/admin/money-trail/page.tsx                         (add tabs)
apps/web/app/admin/money-trail/by-channel-tab.tsx               (NEW tab content)
apps/web/app/admin/money-trail/ad-spend/page.tsx                (NEW form)
```

## Verification

```bash
# 1. Migration
npm run db:migrate -- --name add_channel_attribution_adspend

# 2. Channel detect on click
# Visit / với referer header set to https://facebook.com
# Click any "Xem deal" → ClickLog row: channel="fb", attributionSource="referer"
# Verify cookie `dv_channel=fb` set in browser

# 3. Sub1 attached aff_link
# Inspect Network tab → request to merchant URL contains ?sub1=fb&utm_source=<code>

# 4. Conversion match channel
# Simulate webhook with trackingCode of fb-attributed click
curl -X POST http://localhost:4000/api/v1/webhooks/accesstrade -d '{"trackingCode":"<code>","revenue":50000,...}'
# DB: ConversionWebhook.channel = "fb"

# 5. By-channel query
curl http://localhost:4000/api/v1/admin/money-trail/channels?days=7 -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: array per channel

# 6. Ad spend CRUD
curl -X POST http://localhost:4000/api/v1/admin/ad-spend -H "..." -d '{"channel":"fb","weekStartDate":"2026-05-19","amount":500000}'
# expect: 200/201

# 7. ROAS calc
# Spend fb 500k, revenue fb 1.5tr → ROAS 3.0 in widget

# 8. Direct attribution edge case
# Visit / direct (no referer, no utm) → channel = "direct"

# 9. UTM override
# Visit /?utm_source=zalo&... from FB referer → channel = "zalo" (utm wins)
```

## Definition of done

- [ ] Schema migrated: ClickLog.channel + ConversionWebhook.channel + AdSpend table.
- [ ] Channel detect logic priority: utm > cookie > referer > default.
- [ ] First-touch cookie `dv_channel` persist 30 ngày.
- [ ] Tracking action append `?sub1=<channel>` to aff_link.
- [ ] Webhook handler copy channel từ ClickLog.
- [ ] Money Trail by-channel endpoint với 4-6 row default.
- [ ] AdSpend CRUD endpoint + admin form.
- [ ] Channel ROAS widget replace placeholder.
- [ ] Money Trail page có tab "Theo kênh".
- [ ] Decay banner nudge operator nhập ad spend.

## Notes for next session

- AT `_extra.parameters.sub1` từ `/v1/transactions` — verify khi reconcile có match đúng `ClickLog.channel`. Nếu mismatch → log warning. Có thể defer Path B verify cho sprint sau.
- Channel `other` cho referrer ko match — operator có thể tinh chỉnh sau khi data về.
- ROAS color tier: green ≥2, amber 1-2, red <1. Có thể adjust.
- `AdSpend` weekStartDate = Monday VN. UI dùng date picker pick Monday.
- Sub2, sub3, sub4 hiện ko dùng — reserve cho future (vd: sub2 = niche, sub3 = experiment variant).
- Khi storefront-v2 STORY-08 capture subscribers merge, email channel sẽ có data thật từ digest send.
- Email digest send link cần append `?utm_source=email` để hit channel detect.
