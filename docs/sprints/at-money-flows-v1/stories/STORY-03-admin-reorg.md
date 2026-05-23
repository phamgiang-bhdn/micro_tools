# STORY-03 — Admin re-org: sidebar 4 nhóm + dashboard 7-widget gà-mờ home

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 5h
**Dependencies:** STORY-01 (AT-only cleanup) + STORY-02 (sync endpoints). Story này mount component đã được tạo trong STORY-02 (SyncAllButton, LastSyncStatusWidget).

## Context

Audit admin UI 2026-05-23 ([07-admin-login.png](https://example.local/dv-screens/07-admin-login.png)):

Sidebar hiện có **≥12 menu top-level**:
- Bảng điều khiển
- Duyệt sản phẩm (Refinery)
- Chiến dịch (Campaign AT)
- Nhật ký lấy sản phẩm
- Đối soát đơn
- Xưởng prompt AI
- Ngành hàng (Niche)
- Phân loại AT (AT category)
- Nguồn bán (Source)
- Tên miền
- Cửa hàng (Shop)
- Sản phẩm
- Mã giảm giá
- Bài viết

Vấn đề với gà mờ:
- Không biết click đâu trước.
- Không biết "Phân loại AT" khác "Ngành hàng" thế nào.
- Không biết "Xưởng prompt AI" để làm gì.
- Quá nhiều entry điểm → overwhelm.

Dashboard hiện tại (`/admin`) — KPI placeholder 4 ô (Doanh thu, Conversion rate, Token budget, Crawler status) + "Hôm nay cần xử lý" 3 card + "Lối tắt" 4 button + "Điều khiển crawler" + "Import nhanh URL".

Vẫn OK structure nhưng:
- Token budget = "100.000" placeholder (chưa wired thật).
- Crawler status = "Check" (cần wire `LastSyncStatus`).
- "Hôm nay cần xử lý" cần là queue thật, có badge count.
- "Cơ hội tuần" widget chưa có (sẽ thêm khi STORY-04 merge).
- "Tiền theo kênh" widget chưa có (STORY-06).
- "Link ngoài site" widget chưa có (STORY-08).

## User story

> **As** gà mờ operator login admin lần đầu hoặc daily ritual,
> **I want** thấy ngay tôi cần làm gì hôm nay trong 1 page, không phải đi tìm 12 menu,
> **so that** tôi xài admin 5-7 phút/ngày là đủ.

## Acceptance criteria

### AC1 — Sidebar 4 nhóm + advanced collapse

File: `apps/web/components/admin/layout/sidebar.tsx` (verify path).

Refactor structure:

```
🏠  Trang chủ                          → /admin
─────────────────
✅  VIỆC HÔM NAY
    🟢 Duyệt sản phẩm           [12]   → /admin/refinery
    🟢 Duyệt bài viết            [3]   → /admin/articles?status=PENDING_REVIEW
    🟢 Duyệt mã giảm             [5]   → /admin/coupons?isActive=false
─────────────────
📝  NỘI DUNG
    📄 Bài viết                         → /admin/articles
    🎟 Mã giảm                          → /admin/coupons
─────────────────
💰  TIỀN & HIỆU SUẤT
    💵 Doanh thu                        → /admin/money-trail
    🔗 Link ngoài site                  → /admin/external-links (STORY-08)
─────────────────
⚙️  CÀI ĐẶT
    🏷 Niche (danh mục)                → /admin/niches
    🎯 Campaign Accesstrade             → /admin/campaigns
    ▼ Hệ thống nâng cao
       ⚡ Xưởng prompt AI               → /admin/prompts
       🔍 Phân loại AT                  → /admin/at-categories
       🏪 Cửa hàng (Shop)               → /admin/shops
       🌐 Nguồn bán / Tên miền          → /admin/sources
       🔧 Import URL → AI ingest        → /admin/import-url (web-scrape tool)
       📊 Nhật ký lấy sản phẩm           → /admin/crawler-logs
```

Implementation:
- Use existing UI atoms (avoid new dep).
- "Hệ thống nâng cao" collapsed default. State stored localStorage `admin_advanced_expanded`.
- Badge `[12]` cho count "Việc hôm nay" — fetch từ API count endpoint.

NEW endpoint `GET /admin/queues/counts` → `{ refinery: 12, articlesPending: 3, couponsPending: 5 }`. Cached 30s ISR-style.

### AC2 — Dashboard layout 7 widget

File: `apps/web/app/admin/page.tsx` (replace toàn bộ JSX).

Layout structure (desktop ≥1024px — 2-3 col grid):

```
┌─────────────────────────────────────────────────────────────────┐
│  [Header banner cảnh báo nếu anyStale=true]                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌────────────────────────────────────┐
│ 👋 Xin chào! KPI     │  │ 🔄 Đồng bộ dữ liệu                 │
│ • Hôm qua: X click → │  │ [SyncAllButton]                    │
│   Y đơn → Z VND      │  │                                    │
│ • Tháng: A click →   │  │ [Step results khi running]         │
│   B đơn → C VND      │  │                                    │
│ (KPI widget)         │  │ (SyncAll widget)                   │
└──────────────────────┘  └────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ✅ VIỆC HÔM NAY (~ 5 phút)                                     │
│                                                                 │
│ 🟢 Duyệt sản phẩm (12 mới, 8 đã auto)    [Duyệt nhanh →]      │
│ 🟡 Duyệt bài viết (1 chờ publish)        [Xem →]              │
│ 🟢 Duyệt mã giảm (5 mới)                 [Duyệt nhanh →]      │
│                                                                 │
│ (TodayQueue widget)                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🔥 CƠ HỘI TUẦN — placeholder until STORY-04 merge              │
│ "Sắp ra mắt: tip viết bài kiếm tiền nhất tuần này"            │
│ (CommissionKeywordWidget)                                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌────────────────────────────────────┐
│ 💵 TIỀN THEO KÊNH    │  │ 🔗 LINK NGOÀI SITE                 │
│ placeholder STORY-06 │  │ placeholder STORY-08              │
│ "Sắp ra mắt"         │  │ "Sắp ra mắt"                       │
│ (ChannelROAS widget) │  │ (ExternalLinkKPI widget)           │
└──────────────────────┘  └────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⚙ HỆ THỐNG (4 luồng nền)                                       │
│ ✓ Crawler  chạy 14:00  (cách 6h ago)                          │
│ ✓ Đối soát chạy 14:30  (cách 30 phút)                         │
│ ✓ Coupon   chạy 12:00  (cách 6h)                              │
│ ✓ Top deal chạy 03:00  hôm nay                                │
│ → Tất cả OK                                                    │
│ (LastSyncStatusWidget — STORY-02)                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⚡ THAO TÁC NHANH                                              │
│ [+ Tạo bài mới]  [+ Thêm Campaign]  [Xem storefront ↗]        │
└─────────────────────────────────────────────────────────────────┘
```

Mobile <1024px: stack vertical, 1 col, padding nhỏ.

### AC3 — KPI widget (data thật)

NEW: `apps/web/components/admin/dashboard/kpi-widget.tsx` (RSC).

Fetch:
- Hôm qua: `ClickLog.count where createdAt between yesterday00 and yesterday24` + `ConversionWebhook.sum(revenue) where createdAt between...`.
- Tháng này: same logic but rolling 30-day or current calendar month.

Display:

```tsx
<div className="rounded-xl border border-line bg-card p-5">
  <h3 className="text-sm font-semibold text-ink">Xin chào! 👋</h3>
  <p className="mt-1 text-xs text-ink-soft">Site bạn hôm nay thế nào?</p>
  <div className="mt-4 space-y-2 text-sm">
    <div className="flex items-baseline gap-2">
      <span className="text-ink-soft">Hôm qua:</span>
      <span className="font-bold text-ink">{yClicks} click</span>
      <span className="text-ink-mute">→</span>
      <span className="font-bold text-ink">{yOrders} đơn</span>
      <span className="text-ink-mute">→</span>
      <span className="font-bold text-emerald-600">{formatMoney(yRevenue)}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-ink-soft">Tháng này:</span>
      <span className="font-bold text-ink">{mClicks} click</span>
      <span className="text-ink-mute">→</span>
      <span className="font-bold text-ink">{mOrders} đơn</span>
      <span className="text-ink-mute">→</span>
      <span className="font-bold text-emerald-600">{formatMoney(mRevenue)}</span>
    </div>
  </div>
</div>
```

Endpoint: `GET /admin/kpi/summary` → `{ yesterday: {...}, month: {...} }`.

### AC4 — Today queue widget

NEW: `apps/web/components/admin/dashboard/today-queue-widget.tsx` (RSC).

Fetch từ `GET /admin/queues/counts` (AC1).

Render 3 row, mỗi row có status indicator + count + action button:

```tsx
<div className="rounded-xl border border-line bg-card p-5">
  <h3 className="text-base font-semibold text-ink">✅ Việc hôm nay</h3>
  <p className="mt-0.5 text-xs text-ink-soft">~ 5 phút là xong</p>

  <ul className="mt-4 space-y-2">
    <QueueRow
      tone={refineryCount > 0 ? "green" : "gray"}
      label={`Duyệt sản phẩm (${refineryCount} mới${refineryAutoCount > 0 ? `, ${refineryAutoCount} đã auto` : ''})`}
      ctaLabel="Duyệt nhanh"
      ctaHref="/admin/refinery"
      disabled={refineryCount === 0}
    />
    <QueueRow
      tone={articlesPendingCount > 0 ? "yellow" : "gray"}
      label={`Duyệt bài viết (${articlesPendingCount} chờ publish)`}
      ctaLabel="Xem"
      ctaHref="/admin/articles?status=PENDING_REVIEW"
      disabled={articlesPendingCount === 0}
    />
    <QueueRow
      tone={couponsPendingCount > 0 ? "green" : "gray"}
      label={`Duyệt mã giảm (${couponsPendingCount} mới)`}
      ctaLabel="Duyệt nhanh"
      ctaHref="/admin/coupons?isActive=false"
      disabled={couponsPendingCount === 0}
    />
  </ul>
</div>
```

`QueueRow` sub-component:
- tone determines indicator dot color.
- disabled state: gray + button disabled khi count=0.
- Compact 1-line layout, mobile responsive.

### AC5 — Placeholder widgets cho STORY-04/06/08

3 widget chưa có data thật (STORY sau merge sẽ wire):

NEW: `apps/web/components/admin/dashboard/commission-keyword-widget.tsx`:

```tsx
export function CommissionKeywordWidget() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-card-soft p-5">
      <h3 className="text-base font-semibold text-ink">🔥 Cơ hội tuần</h3>
      <p className="mt-2 text-xs text-ink-soft">
        Niche + merchant nào trả % cao nhất + keyword đang hot.
      </p>
      <p className="mt-3 text-[11px] text-ink-mute">
        Sắp ra mắt — story <code>STORY-04</code> đang implement.
      </p>
    </div>
  );
}
```

Tương tự cho `ChannelROASWidget` (STORY-06) + `ExternalLinkKPIWidget` (STORY-08). Mỗi placeholder ≤30 dòng.

Khi STORY-04/06/08 merge, các story đó replace placeholder bằng real implementation (chỉ đổi nội dung widget, ko đụng layout dashboard).

### AC6 — Quick actions widget

```tsx
<div className="rounded-xl border border-line bg-card p-5">
  <h3 className="text-sm font-semibold text-ink">⚡ Thao tác nhanh</h3>
  <div className="mt-3 flex flex-wrap gap-2">
    <Link href="/admin/articles/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
      + Tạo bài mới
    </Link>
    <Link href="/admin/campaigns" className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:border-brand-300">
      + Thêm Campaign
    </Link>
    <Link href="/" target="_blank" className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:border-brand-300">
      Xem storefront ↗
    </Link>
  </div>
</div>
```

### AC7 — Mount SyncAllButton + LastSyncStatusWidget

Import 2 component từ STORY-02 vào dashboard layout. Mount đúng vị trí trong grid theo AC2.

### AC8 — Header banner cảnh báo

Component: `apps/web/components/admin/layout/stale-banner.tsx` (RSC).

```tsx
export async function StaleBanner() {
  const status = await adminFetch<SyncStatus[]>("/admin/sync/status", "GET");
  const stale = status.filter(s => s.isStale);
  if (stale.length === 0) return null;
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
      <Link href="/admin" className="flex items-center gap-2">
        <AlertTriangle className="size-4" />
        <span>⚠ Dữ liệu đang lag — {stale.length} luồng chưa đồng bộ &gt; 2× tần suất. <span className="underline">Đồng bộ ngay →</span></span>
      </Link>
    </div>
  );
}
```

Mount trong `apps/web/app/admin/layout.tsx` ngay sau header.

### AC9 — Onboarding tour (first login)

Khi `LastSyncStatus.lastSuccessAt` all null (chưa từng sync), hiện overlay welcome:

NEW: `apps/web/components/admin/dashboard/onboarding-overlay.tsx` (client).

3-step tour:

```
Step 1: Welcome
"Chào mừng đến dealvault admin! Trước khi bắt đầu, hãy thực hiện 3 bước:"
[Bắt đầu →]

Step 2: Sync data
"Click 'Đồng bộ tất cả' để pull deal đầu tiên từ Accesstrade."
[Đã sync →] (button highlight SyncAllButton — wait until lastSuccessAt updates)

Step 3: Assign campaign  
"Bạn cần assign campaign Accesstrade vào niche để crawler biết pull cho niche nào."
[Đi tới /admin/campaigns →]
```

State: localStorage `admin_onboarding_complete=true` sau khi click "Hoàn tất". Skip nếu localStorage có flag.

### AC10 — Mobile admin layout

Sidebar collapse sang drawer mobile <1024px (hamburger trigger).

Dashboard widget stack vertical 1 col mobile.

KPI widget có dạng compact mobile (2 dòng thay vì grid).

## Files touched

```
apps/web/components/admin/layout/sidebar.tsx                    (refactor 4 nhóm + advanced collapse)
apps/web/components/admin/layout/stale-banner.tsx               (NEW)
apps/web/app/admin/layout.tsx                                   (mount StaleBanner)
apps/web/app/admin/page.tsx                                     (rewrite — 7 widget grid)
apps/web/components/admin/dashboard/kpi-widget.tsx              (NEW RSC)
apps/web/components/admin/dashboard/today-queue-widget.tsx      (NEW RSC)
apps/web/components/admin/dashboard/quick-actions-widget.tsx    (NEW)
apps/web/components/admin/dashboard/commission-keyword-widget.tsx  (NEW placeholder)
apps/web/components/admin/dashboard/channel-roas-widget.tsx     (NEW placeholder)
apps/web/components/admin/dashboard/external-link-kpi-widget.tsx (NEW placeholder)
apps/web/components/admin/dashboard/onboarding-overlay.tsx      (NEW client)
apps/api/src/modules/admin/admin.controller.ts                  (add GET /admin/queues/counts + GET /admin/kpi/summary)
apps/web/app/api/admin/queues/counts/route.ts                   (NEW proxy)
apps/web/app/api/admin/kpi/summary/route.ts                     (NEW proxy)
```

## Verification

```bash
# 1. Sidebar groups
# Open /admin → expect sidebar 4 group + "Hệ thống nâng cao" collapse
# Click expand → 5 advanced item visible

# 2. Dashboard render
# Open /admin → expect 7 widget visible
# KPI có số thật (nếu DB có data) hoặc "0" gracefully

# 3. Queue counts
curl http://localhost:4000/api/v1/admin/queues/counts -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: {refinery: N, articlesPending: M, couponsPending: K}

# 4. Onboarding
# Reset localStorage admin_onboarding_complete + reset LastSyncStatus
# Open /admin → expect overlay step 1
# Click through steps → localStorage flag set

# 5. Stale banner
# Set crawler.lastSuccessAt = 2 days ago
# Open /admin → expect red banner top

# 6. Mobile
# Resize to 390x844 → sidebar drawer, widgets stack 1 col
```

## Definition of done

- [ ] Sidebar 4 nhóm + advanced collapse.
- [ ] Badge count fetch real-time cho 3 queue.
- [ ] Dashboard 7 widget render đúng layout.
- [ ] KPI widget fetch real data (ClickLog + ConversionWebhook).
- [ ] Today queue widget có CTA + disabled state khi count=0.
- [ ] 3 placeholder widget cho STORY-04/06/08 (có thể replace sau).
- [ ] SyncAllButton + LastSyncStatusWidget mount đúng vị trí.
- [ ] Stale banner hiện khi anyStale=true.
- [ ] Onboarding overlay first-login 3 step.
- [ ] Mobile responsive.

## Notes for next session

- "Advanced" menu collapse — operator có thể expand khi cần, save trong localStorage.
- "Onboarding overlay" trigger từ `LastSyncStatus.lastSuccessAt = null` cho mọi backbone. Sau khi sync 1 lần thì cleared.
- STORY-04 sẽ replace `CommissionKeywordWidget` placeholder bằng real implementation.
- STORY-06 sẽ replace `ChannelROASWidget`.
- STORY-08 sẽ replace `ExternalLinkKPIWidget`.
- STORY-10 sẽ tinh chỉnh button "Tạo bài mới" link → wizard mới thay vì form hiện tại.
- KPI widget có thể slow nếu DB lớn — add index `ClickLog(createdAt)` + `ConversionWebhook(createdAt)` nếu chưa có.
