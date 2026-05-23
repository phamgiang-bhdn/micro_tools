# STORY-05 — Mobile-first header + sticky bottom nav

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P1
**Estimate:** 3h
**Dependencies:** STORY-09 (brand) — header logo / tagline phụ thuộc brand decision.

## Context

Mobile screenshot 2026-05-23 ([02-home-mobile.png](https://example.local/dv-screens/02-home-mobile.png)):

- Header chỉ có logo + 1 search icon. **Không có hamburger menu** → user mobile không có cách điều hướng nhanh tới các surface khác (Deal hot, Cẩm nang, Mã giảm).
- Desktop screenshot có 4 menu link top (Khám phá / Deal hot / Mới về / Cẩm nang) — không show trên mobile.
- **Không có sticky bottom nav** — affiliate VN sites đều có (cellphones, voucher.com) cho 1-tap navigation.

**Pattern affiliate VN mobile**:
- Sticky bottom-bar 4-5 icon: Trang chủ / Deal hot / Cẩm nang / Mã giảm / Tài khoản.
- Header sticky: hamburger + logo + search + bell (notification subscribe).
- Hamburger panel slide-from-left với menu cấu trúc rõ: Top niches → Tất cả danh mục → Cẩm nang → Mã giảm → Vì sao chúng tôi → Liên hệ.

## User story

> **As** user VN browse trên iPhone 12 mini (390×844),
> **I want** 1-tap reach mọi surface chính (deal hot, cẩm nang, mã giảm) bất kỳ chỗ nào tôi đang ở,
> **so that** tôi không phải scroll-to-top + click "Khám phá" menu mỗi lần.

## Acceptance criteria

### AC1 — Mobile hamburger header

File: [apps/web/components/layout/header.tsx](../../../../apps/web/components/layout/header.tsx) (tìm file actual — có thể tên khác như `site-header.tsx`).

Refactor responsive:
- **Desktop ≥1024px**: giữ layout hiện tại (logo + horizontal nav links + search + admin button).
- **Mobile <1024px**:
  - Left: hamburger icon button (44×44 touch target).
  - Center: logo (smaller).
  - Right: search icon (open mobile search overlay).
  - Hide nav links.

Hamburger click → opens `<MobileMenuPanel>` slide-in from left.

### AC2 — Mobile menu panel

NEW component: `apps/web/components/layout/mobile-menu-panel.tsx` (client component).

Structure:

```
┌─────────────────────────┐
│ [✕]  dealvault  [bell]  │ ← close + logo + notification subscribe shortcut
├─────────────────────────┤
│ HOT                     │
│  🔥 Deal hot tuần       │
│  ⏰ Mã giảm đang còn    │
│  📑 Cẩm nang chọn mua   │
├─────────────────────────┤
│ DANH MỤC ƯU TIÊN        │
│  💻 Laptop              │
│  🎧 Tai nghe TWS        │
│  🤖 Robot hút bụi       │
│  💨 Máy lọc không khí   │
│  ⌚ Đồng hồ thông minh  │
│  🧴 Mỹ phẩm dưỡng da    │
├─────────────────────────┤
│  Xem 100 danh mục →     │
├─────────────────────────┤
│ KHÁC                    │
│  ℹ️ Vì sao dealvault    │
│  📧 Liên hệ             │
│  📜 Chính sách affiliate│
└─────────────────────────┘
```

Implementation:
- Slide-in animation 250ms.
- Backdrop overlay click → close.
- Body scroll lock khi open.
- Curated niches từ `CURATED_NICHES` (STORY-02 const).
- Click link → navigate + auto-close panel.

### AC3 — Sticky bottom nav

NEW component: `apps/web/components/layout/mobile-bottom-nav.tsx`.

Render condition: viewport <1024px AND not on `/admin/*` routes.

Layout:

```
┌──────────────────────────────────────────┐
│  🏠     🔥      📑     ⏰      ⊕        │
│ Trang  Deal   Cẩm    Mã     Đăng        │
│ chủ   hot   nang   giảm    deal         │
└──────────────────────────────────────────┘
```

5 tab:
1. **Trang chủ** → `/`
2. **Deal hot** → `/deal-hot` (STORY-07, fallback `/?sort=top` nếu chưa làm)
3. **Cẩm nang** → `/blog`
4. **Mã giảm** → `/khuyen-mai` (STORY-06 index)
5. **Đăng deal** → click trigger email/push subscribe modal (STORY-08, fallback link tới `/dang-ky`)

Spec:
- Height: 56px + safe-area-inset-bottom.
- Background: white + border-top-line + slight shadow.
- Active tab: brand-600 color + underline 2px on top.
- Inactive: ink-mute icon + ink-soft text.
- Text: 10px font-medium, single line.
- Icon: 22×22.

Position: `fixed bottom-0 left-0 right-0 z-30`.

Body padding: add `pb-[64px]` ở mobile để content không bị che — apply ở `<RootLayout>` mobile-only.

### AC4 — Search overlay (mobile)

NEW component: `apps/web/components/layout/mobile-search-overlay.tsx`.

Click search icon từ header → full-screen overlay với:
- Top: input + close button.
- Below: 8 "Tìm kiếm phổ biến" chip (hardcoded list: "laptop gaming", "robot hút bụi", "tai nghe sony", "đồng hồ apple watch", "máy lọc không khí xiaomi", "kem chống nắng anessa", "iphone 15", "macbook m3").
- Below: "Truy cập nhanh" 3 link (Deal hot tuần, Mã giảm còn dùng, Cẩm nang mới).

Input submit → navigate `/?q={query}`.

### AC5 — Bell icon (notification subscribe shortcut)

Trong mobile menu panel header, có icon `<Bell>` ngay cạnh logo.

Click → open subscribe modal (STORY-08 sẽ implement modal thật). Tạm thời:

```tsx
<button onClick={() => alert("Tính năng đăng ký deal sẽ ra trong tuần tới")}>
```

→ STORY-08 sẽ replace handler.

### AC6 — Active state detection

Cả bottom nav + side menu cần highlight tab/menu item current route.

Implementation: `usePathname()` từ `next/navigation` (client component OK), compare với `href` prefix.

```ts
const pathname = usePathname();
const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
```

### AC7 — Accessibility

- Hamburger button: `aria-label="Mở menu"` + `aria-expanded` reflecting state.
- Bottom nav: each tab `aria-label="Trang chủ"` etc + `aria-current="page"` if active.
- Search overlay input: `aria-label="Tìm sản phẩm"`.
- Focus trap khi mobile menu open (use `react-focus-lock` hoặc manual implementation).
- Esc key → close menu / overlay.

### AC8 — Desktop unchanged

Desktop ≥1024px:
- Header giữ horizontal nav như hiện tại.
- Bottom nav KHÔNG render.
- Search vẫn inline trong header (không overlay).

## Files touched

```
apps/web/components/layout/header.tsx                            (responsive refactor)
apps/web/components/layout/mobile-menu-panel.tsx                 (NEW, client component)
apps/web/components/layout/mobile-bottom-nav.tsx                 (NEW, client component)
apps/web/components/layout/mobile-search-overlay.tsx             (NEW, client component)
apps/web/app/layout.tsx                                          (mount bottom nav, add mobile padding-bottom)
apps/web/lib/curated-niches.ts                                   (shared with STORY-02)
```

## Verification

```bash
# 1. Build
npm run build --workspace web

# 2. Screenshot mobile
node scripts/screenshot-pages.mjs # với viewport 390×844 cho mọi page
# expect: bottom nav visible trên mọi public route, hidden trên /admin
# expect: hamburger visible top-left

# 3. Manual touch test
# Open Chrome devtools mobile emulation → tap hamburger → side panel
# tap each bottom nav tab → navigate + active state update

# 4. Accessibility
# Tab key navigation through bottom nav tabs.
# Esc closes mobile menu.

# 5. Desktop unchanged
# 1440×900 → no bottom nav, header horizontal.
```

## Definition of done

- [ ] Mobile <1024px: hamburger + bottom nav active trên mọi public route.
- [ ] Bottom nav 5 tab có active state highlight.
- [ ] Mobile menu panel slide animation smooth.
- [ ] Search overlay full-screen với suggestion + popular queries.
- [ ] Desktop layout không thay đổi.
- [ ] Bottom nav KHÔNG render trên `/admin/*`.
- [ ] Body padding-bottom 64px mobile prevent content che.
- [ ] Esc key close menu/overlay.

## Notes for next session

- "Đăng deal" tab trong bottom nav cần STORY-08 modal — placeholder tạm.
- Active state cho parent route (e.g. `/categories/laptop` highlight "Trang chủ") — coi như Trang chủ active. Có thể tinh chỉnh sau.
- Nếu user scroll xuống bottom nav che footer, OK chấp nhận — footer ít quan trọng hơn nav.
- Search overlay popular queries hard-coded list. Sau có thể move sang DB column `SearchSuggestion` table nếu cần dynamic.
- Bell icon notification — STORY-08 sẽ wire real handler. Đừng implement modal trong STORY-05.
