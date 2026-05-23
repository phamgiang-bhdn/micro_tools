# STORY-08 — Email + push capture + PriceWatch placeholder

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P2
**Estimate:** 6h
**Dependencies:** STORY-09 (footer + about page có link to subscribe).

## Context

Site hiện tại không có cơ chế nào để **giữ user quay lại**. Affiliate site sống bằng return-user vì:
- Cold traffic SEO 1 lần thường bounce, ko mua ngay.
- User search "X giá tốt", đọc, đi nơi khác → quên domain.
- Return-user CR cao gấp 3-5 lần cold user.

3 channel return-user thị trường VN:
1. **Email digest** — daily 7:00 sáng "Top 5 deal hôm nay" + "Mã giảm sắp hết".
2. **Web push** — Browser notification khi có deal hot trong niche user follow.
3. **Zalo OA** — Vietnamese-specific, user follow Zalo Official Account của brand, broadcast nhận deal.

Sprint này build **infrastructure** + **subscribe flow**. Real send (cron job email, push) defer sang sprint sau — story này chỉ collect subscribers + placeholder send.

## User story

> **As** user VN landing đã đọc 2 trang dealvault,
> **I want** ko spam modal mỗi giây, nhưng có 1 cách rõ ràng để đăng ký nhận deal sớm + theo dõi giá sản phẩm cụ thể,
> **so that** tôi không cần check site mỗi ngày + biết khi giá xuống là click.

## Acceptance criteria

### AC1 — Subscriber DB models

Schema migration `apps/api/prisma/schema.prisma`:

```prisma
model Subscriber {
  id              String   @id @default(uuid()) @db.Uuid
  email           String?  @unique             // null cho push-only subscriber
  pushEndpoint    String?  @unique             // null cho email-only
  pushP256dh      String?                      // web push key
  pushAuth        String?                      // web push auth secret
  zaloUserId      String?  @unique             // future
  source          String                       // "modal_home"|"deal_hot_footer"|"after_click"|"about_page"
  preferredNiches String[] @default([])        // niche slugs user select khi subscribe
  status          SubscriberStatus @default(ACTIVE)
  confirmedAt     DateTime?                    // double-opt-in email confirm
  unsubscribedAt  DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  watches         PriceWatch[]

  @@index([source])
  @@index([status])
}

enum SubscriberStatus {
  PENDING            // chưa confirm email
  ACTIVE
  UNSUBSCRIBED
  BOUNCED
}

model PriceWatch {
  id              String   @id @default(uuid()) @db.Uuid
  subscriberId    String   @db.Uuid
  subscriber      Subscriber @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  productId       String   @db.Uuid
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  basePrice       Int                           // giá lúc user add watch
  notifyDropPercent Int   @default(5)           // notify khi giảm ≥X%
  lastNotifiedAt  DateTime?
  lastNotifiedPrice Int?
  status          String   @default("ACTIVE")
  createdAt       DateTime @default(now())

  @@unique([subscriberId, productId])
  @@index([productId, status])
}
```

Migration: `npm run db:migrate -- --name add_subscriber_pricewatch`.

### AC2 — Email subscribe modal

NEW component: `apps/web/components/storefront/subscribe-modal.tsx` (client).

Trigger logic:
- **First visit**: KHÔNG show.
- **Visit 2+ (cookie `dv_visits` ≥ 2)** AND ko subscribed yet (cookie `dv_subscribed != "1"`): show 8 giây sau khi landed.
- **After ≥1 affiliate click** (cookie `dv_clicked ≥ 1`): show ngay khi visit kế tiếp.
- **Manual trigger**: click "Đăng ký nhận deal" trong header bell / footer / bottom nav "Đăng deal" tab → show immediately.
- **Dismissed once**: cookie `dv_modal_dismissed = "1"` (30 ngày TTL) → ko show auto, chỉ qua manual trigger.

Layout:

```
┌─────────────────────────────────────────┐
│                                    [✕]  │
│            📧 Nhận deal sớm nhất         │
│                                         │
│   Mỗi 7:00 sáng, chúng tôi gửi top 5    │
│   deal hot + mã giảm còn dùng trong     │
│   24h. Không spam, hủy bất kỳ lúc nào.  │
│                                         │
│   📩 Email:                             │
│   ┌─────────────────────────────────┐   │
│   │ vidu@gmail.com                  │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Quan tâm danh mục: (chọn tối đa 3)   │
│   [✓ Laptop] [✓ Tai nghe TWS]          │
│   [Robot hút bụi] [Mỹ phẩm] [...]      │
│                                         │
│   ┌───────────────────────────────────┐ │
│   │ Đăng ký nhận deal                 │ │
│   └───────────────────────────────────┘ │
│                                         │
│   Bằng việc đăng ký, bạn đồng ý với    │
│   chính sách bảo mật.                  │
└─────────────────────────────────────────┘
```

Submit → POST `/api/v1/subscribers` body `{ email, source, preferredNiches[] }`.

API response: `{ subscriberId, requiresConfirmation: true }`.

Sau submit:
- Set cookie `dv_subscribed=1` (1 năm TTL).
- Toast: "Đã gửi link xác nhận tới {email}. Mở email để confirm."
- Modal close.

### AC3 — Backend API endpoints

NEW controller `apps/api/src/modules/subscribers/subscribers.controller.ts`:

```
POST   /api/v1/subscribers           // create new subscriber (email/push)
GET    /api/v1/subscribers/confirm/:token   // double-opt-in confirm via email link
DELETE /api/v1/subscribers/:id       // unsubscribe (requires unsubscribe token)
POST   /api/v1/subscribers/:id/watches      // add PriceWatch (auth via token)
DELETE /api/v1/subscribers/:id/watches/:watchId
```

`POST /subscribers` validation (Zod):
```ts
const createSubscriberSchema = z.object({
  email: z.string().email().optional(),
  pushEndpoint: z.string().url().optional(),
  pushP256dh: z.string().optional(),
  pushAuth: z.string().optional(),
  source: z.enum(["modal_home", "deal_hot_footer", "after_click", "about_page", "manual_admin"]),
  preferredNiches: z.array(z.string()).max(3).optional().default([])
}).refine(d => d.email || d.pushEndpoint, "Phải có email hoặc push endpoint");
```

`SubscriberService.create()`:
- Generate `confirmationToken` (JWT 7 ngày TTL).
- Send email confirmation **placeholder** — chỉ log `console.log("[email] confirm link: /api/v1/subscribers/confirm/<token>")` cho story này. Real send sang sprint sau.
- Return `{ subscriberId, requiresConfirmation: true }`.

`confirm/:token`:
- Verify JWT.
- Set `Subscriber.confirmedAt = now`, `status = ACTIVE`.
- Redirect tới `/cam-on-da-dang-ky` (NEW page minimal).

### AC4 — Web push subscription

NEW component: `apps/web/components/storefront/push-subscribe-prompt.tsx` (client).

Trigger logic: chỉ sau ≥1 affiliate click (cookie `dv_clicked ≥ 1`) AND ko prompted before:

```tsx
useEffect(() => {
  const clicked = parseInt(getCookie("dv_clicked") ?? "0");
  const prompted = getCookie("dv_push_prompted") === "1";
  if (clicked >= 1 && !prompted && "Notification" in window) {
    showPushPrompt();
  }
}, []);
```

Push prompt UI: small bottom-right toast (NOT browser's default permission popup yet):

```
┌────────────────────────────────────────┐
│ 🔔 Bật thông báo để nhận deal hot ngay?│
│                                        │
│ [Không cảm ơn]      [Bật thông báo →] │
└────────────────────────────────────────┘
```

Click "Bật thông báo":
1. Show browser `Notification.requestPermission()`.
2. Nếu accept: subscribe service worker `navigator.serviceWorker.ready.then(reg => reg.pushManager.subscribe(...))`.
3. POST `/api/v1/subscribers` với pushEndpoint + keys.

Service worker file `apps/web/public/sw.js` (minimal):

```js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Deal mới", body: "Click để xem" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      data: { url: data.url ?? "/" }
    })
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

ENV: `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` cho apps/api. Generate via `web-push generate-vapid-keys` (npm package `web-push`).

### AC5 — PriceWatch button trên product detail

File: [apps/web/components/product-detail-view.tsx](../../../../apps/web/components/product-detail-view.tsx) (verify path).

Thêm button bên cạnh "Mua ngay":

```tsx
<button onClick={openWatchModal}>
  <Bell className="size-4" /> Báo khi giảm giá
</button>
```

Click → open modal:

```
🔔 Theo dõi giá
"{product.name}"
Giá hiện tại: ₫1,290,000

📩 Nhận thông báo khi giảm ≥
[ 5% v ]  giá hiện tại

Email: [_____________]
[ Lưu theo dõi ]
```

Submit → POST `/subscribers` + POST `/subscribers/:id/watches` body `{ productId, basePrice, notifyDropPercent }`.

### AC6 — Cron placeholder

NEW cron job: `apps/api/src/modules/subscribers/subscriber-digest.scheduler.ts`.

```ts
@Cron("0 7 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
async sendDailyDigest() {
  this.logger.log("[digest] Daily digest cron triggered (placeholder, no real send)");
  // TODO: query top 5 deal hôm nay
  // TODO: query active subscribers với confirmedAt != null
  // TODO: for each subscriber, send email với content
  // Real implementation sang sprint sau.
}
```

NEW cron `priceWatchCheck.scheduler.ts`:

```ts
@Cron("0 */3 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
async checkPriceDrops() {
  // for each active PriceWatch, query current Product.price
  // if price <= basePrice * (1 - notifyDropPercent/100) && (lastNotifiedAt null || > 24h ago):
  //   - if subscriber.pushEndpoint: send web push
  //   - if subscriber.email: send email (placeholder log for now)
  //   - update lastNotifiedAt + lastNotifiedPrice
}
```

ENV gate: `DIGEST_ENABLED=false` default — không chạy real send.

### AC7 — Subscribe trigger sources tracking

Mỗi subscribe phải có `source` đúng để track conversion attribution:
- `modal_home`: auto modal trên homepage visit 2+.
- `deal_hot_footer`: form input cuối `/deal-hot/<date>` landing.
- `after_click`: prompt sau khi user click ≥1 affiliate.
- `about_page`: form trong `/ve-chung-toi`.
- `bell_icon`: click bell icon trong mobile menu header.

Operator có thể query `Subscriber.source` group-by để biết channel nào convert tốt nhất.

### AC8 — Unsubscribe + GDPR-ish

Email digest footer (khi implement) phải có unsubscribe link:
- `https://dealvault.vn/api/v1/subscribers/<id>/unsubscribe?token=<jwt>`.
- Click → set `status=UNSUBSCRIBED`, `unsubscribedAt=now`. Redirect tới `/da-huy-dang-ky`.

NEW pages: `apps/web/app/cam-on-da-dang-ky/page.tsx` + `apps/web/app/da-huy-dang-ky/page.tsx` — minimal copy + link about + footer.

### AC9 — Admin dashboard

NEW admin route `/admin/subscribers`:
- List subscribers với filter source / status.
- CSV export.
- Manual unsubscribe (set status=UNSUBSCRIBED).
- View PriceWatch per subscriber.

Endpoint `GET /admin/subscribers` (admin role).

(Can defer to ops sprint nếu UI takes too long. Bottom-line: data exists in DB, can query manually.)

### AC10 — Performance + UX guardrails

- Modal trigger 8s sau landing, KHÔNG block initial render.
- Modal có "X" close + backdrop click close.
- Modal dismiss → cookie `dv_modal_dismissed` 30 ngày → ko show lại auto.
- KHÔNG trigger modal trên `/admin/*`.
- KHÔNG trigger modal nếu UA contains "Googlebot" (SEO bot detection — không spam Google).
- Push prompt KHÔNG trigger nếu user trong session đã click "Không cảm ơn".

## Files touched

```
apps/api/prisma/schema.prisma                                  (add Subscriber + PriceWatch models)
apps/api/prisma/migrations/<ts>_add_subscriber_pricewatch/    (NEW)
apps/api/src/modules/subscribers/subscribers.module.ts        (NEW)
apps/api/src/modules/subscribers/subscribers.controller.ts    (NEW)
apps/api/src/modules/subscribers/subscriber.service.ts        (NEW)
apps/api/src/modules/subscribers/subscriber-digest.scheduler.ts (NEW cron placeholder)
apps/api/src/modules/subscribers/price-watch.scheduler.ts     (NEW cron placeholder)
apps/api/src/modules/subscribers/__tests__/                   (basic unit test)
apps/api/.env.example                                          (add VAPID_PUBLIC_KEY + DIGEST_ENABLED)
apps/web/components/storefront/subscribe-modal.tsx             (NEW client)
apps/web/components/storefront/push-subscribe-prompt.tsx       (NEW client)
apps/web/components/storefront/watch-price-modal.tsx           (NEW client)
apps/web/components/storefront/email-input-form.tsx            (NEW shared input form, reusable cho footer/landing)
apps/web/app/cam-on-da-dang-ky/page.tsx                        (NEW)
apps/web/app/da-huy-dang-ky/page.tsx                           (NEW)
apps/web/app/admin/subscribers/page.tsx                        (NEW admin list)
apps/web/app/admin/subscribers/actions.ts                      (NEW admin actions)
apps/web/public/sw.js                                          (NEW service worker)
apps/web/lib/cookies.ts                                        (NEW helper get/set cookies)
apps/web/lib/api.ts                                            (add subscribe API client)
```

## Verification

```bash
# 1. Migration
npm run db:migrate -- --name add_subscriber_pricewatch
psql -c "\d Subscriber" # verify columns

# 2. Subscribe modal triggers
# Open homepage in incognito. Wait 8s. Modal KHÔNG hiện (visit 1).
# Refresh. Wait 8s. Modal hiện (visit 2).
# Click "Đăng ký nhận deal" form. POST /subscribers returns 200. Email console log shows confirm link.

# 3. Confirm flow
# Visit /api/v1/subscribers/confirm/<token>. Redirect tới /cam-on-da-dang-ky.
# DB: Subscriber.confirmedAt != null, status=ACTIVE.

# 4. Push subscribe
# Click ≥1 affiliate link (cookie dv_clicked >= 1).
# Refresh. Push toast hiện.
# Click "Bật thông báo". Browser permission popup. Accept.
# DB: new Subscriber row với pushEndpoint != null.

# 5. PriceWatch
# Open product detail. Click "Báo khi giảm giá". Submit. DB: PriceWatch row created.

# 6. Cron placeholder
# DIGEST_ENABLED=true npm run dev:api
# Wait 7:00 (or manually trigger). Console log "[digest] Daily digest cron triggered".

# 7. Unsubscribe
# POST /subscribers/<id>/unsubscribe?token=<jwt>. DB: status=UNSUBSCRIBED.

# 8. Admin
# Open /admin/subscribers. See list. Export CSV.
```

## Definition of done

- [ ] Migration applied, models exist.
- [ ] Subscribe modal có trigger logic đúng (visit 2+, after-click, manual).
- [ ] Push subscribe prompt có service worker file + backend stores endpoint.
- [ ] PriceWatch modal trên product detail save data.
- [ ] Cron placeholder logs trigger time (no real send).
- [ ] Unsubscribe + confirm pages exist.
- [ ] Admin subscriber list with CSV export.
- [ ] No modal trigger on /admin/* or for Googlebot.
- [ ] Cookie-gated to prevent spam.

## Notes for next session

- **Real email send** — defer sang sprint sau. Có thể dùng Resend / SendGrid / Mailgun. ENV: `EMAIL_PROVIDER_API_KEY`.
- **Real push send** — install `web-push` npm package, gen VAPID keys, wire vào cron checkPriceDrops + subscriber-digest.
- **Zalo OA** — Vietnamese-specific, requires OA approval. Defer ticket: "Integrate Zalo OA broadcast API".
- **Spam abuse** — rate-limit POST /subscribers per IP (e.g. 3 subscribe / hour). Use `@nestjs/throttler`.
- **GDPR-ish**: VN doesn't have GDPR but Personal Data Decree 13/2023/NĐ-CP. Subscribe consent + unsubscribe link required. Already covered.
- **Reactivation** — nếu user UNSUBSCRIBED, click subscribe lại → reactivate (set status=ACTIVE) thay vì error duplicate.
