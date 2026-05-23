# Sprint: VN Storefront v2 — Money-first rebuild

**Sprint ID:** `vn-storefront-v2`
**Start:** 2026-05-23
**Target end:** 2026-06-13 (3 tuần)
**Owner:** @igapdev01
**Goal:** Refactor storefront + conversion mechanics để site thật sự ra tiền với user Việt Nam, không chỉ "list product + viết blog".

---

## Vấn đề (problem statement)

Tới `sprint at-source-of-truth` (2026-05-30) thì pipeline backend đã đủ: AT campaign sync → crawler per-campaign → HITL extraction → article AI multi-stage. Nhưng audit thực tế 2026-05-23 cho thấy storefront **chưa sẵn sàng ra tiền** vì 4 vấn đề thuộc về user-facing layer, không phải pipeline:

1. **UX không phù hợp thị trường VN**:
   - Tên brand `dealvault` user VN không đọc/hiểu/nhớ được → 0 organic word-of-mouth.
   - Hero homepage ôm full fold theo style Silicon Valley SaaS — affiliate VN thắng là `cellphones`/`sforum`/`voucher.com.vn` style: dense, info-rich, urgent, deal-first.
   - Empty state hiện code dev (`Chạy npm run db:reset`) cho end-user.
   - 100 niches flat chip row → decision fatigue.

2. **Luồng conversion thiếu mảng**:
   - Click outbound từ blog (`ProductCardEnd`, `StickyProductCta`) + homepage (`TopProductCard`) bypass `trackAndRedirectAction` → mất attribution.
   - `createTrackingRedirect` không có timeout/fallback — API hiccup = hard 500, mất conversion.
   - Card sản phẩm bắt user click 2 lần (card → detail → "Mua ngay"). Không có inline "Xem deal ngay" trên grid.
   - Không có sticky bottom CTA mobile cho product detail.

3. **Trust + urgency signals trống**:
   - ProductCard không show store rating (Lazada Mall / Shopee Mall / Tiki Trading).
   - Không có "Đã đối chiếu DD/MM" (verified-price chip).
   - Không có "X người đã mua" social proof.
   - Coupon hub không có expiry countdown, không "Còn X mã" stock indicator.

4. **Return-user mechanism = 0**:
   - Không có push notification subscribe.
   - Không có email capture.
   - Không có price-drop alert.
   - Không có Zalo OA touchpoint.
   - Không có daily-deal landing để bắn FB ads.

Hệ quả: ngay cả khi operator đổ 100 product + 10 article vào DB hôm nay, site vẫn convert kém vì những thứ trên là conversion lever, không phải code bug.

---

## Mục tiêu sprint

Xây dựng **conversion-grade storefront** cho thị trường VN, giữ nguyên backend pipeline (AT/AI/HITL — đã thắng ở sprint trước). Sau sprint này:

- User VN landing → thấy deal thật trong fold đầu → 1 click đi affiliate (qua tracking) → cookie attribution chuẩn.
- Mobile-first UX dày trust signal kiểu `cellphones`/`sforum`.
- Coupon hub có urgency thật (countdown + stock).
- Email/push capture chạy, có cron job placeholder cho daily digest + price-drop alert (gửi thật để sprint tiếp).
- Daily-deal landing `/deal-hot/<date>` ready để chạy FB ads ngân sách thử nghiệm.
- Brand identity tiếng Việt rõ ràng — header, footer, About page có tone bản địa.

## Outcomes đo được

| Outcome | Cách đo |
|---|---|
| Homepage above-fold có ≥6 product card visible (desktop 1440x900, mobile 390x844) | Screenshot |
| 100% affiliate click route qua `trackAndRedirectAction` (zero raw `<a href={affiliateUrl}>`) | Grep CI check |
| Tracking action có timeout ≤4s + fallback graceful | Unit test |
| Product card có ≥3 trust signal (store badge, verified date, social proof) | Visual check |
| Coupon card có countdown + stock indicator | Visual check |
| Mobile sticky bottom-bar nav active trên mọi route | Visual check |
| `/deal-hot/<date>` route 200 + OG image generate | curl test |
| Email/push capture modal hiện 1 lần per session, store vào DB | Manual QA |
| Footer KHÔNG mention "Accesstrade" (B2B noise) | Grep check |
| Empty state copy không leak dev instruction | Grep check |

## Nguyên tắc bất di

- **HITL gate giữ nguyên** — không bypass `PENDING_REVIEW` cho product / `DRAFT` cho article. Storefront chỉ thấy `isPublic=true` (product) + `status=PUBLISHED` (article).
- **trackingCode contract bất biến** — 32-char dashless uuid, append `utm_source=<code>` vào affiliate URL. Đừng đổi shape.
- **Không phá backend pipeline** — sprint trước (at-source-of-truth) vừa stable, không refactor AI service / crawler / AT client.
- **Vietnamese tone**: forbid Vinglish ("vibe", "cool", "deal hunter"...). Copy phải đọc tự nhiên cho user VN 25-45 tuổi.
- **Mobile-first**: thiết kế cho viewport 390x844 trước, desktop là enhancement.
- **Performance budget**: trang public LCP ≤2.5s 4G, JS bundle gốc ≤80KB gzip per route.

---

## Mental model

```
[Backend pipeline]                  ← Sprint at-source-of-truth (DONE)
   ↓ HITL approved data
[Storefront v1 hiện tại]            ← Functional nhưng UX không convert
   ↓ refactor SP-2x stories
[Storefront v2 — VN conversion]     ← Sprint này
   ↓ ops onboard content (STORY-10)
[Live + earning]
```

---

## Scope — 10 stories

### Phase 1: Foundation (must-do trước khi release)

| Story | Tiêu đề | Priority | Estimate |
|---|---|---|---|
| [STORY-01](stories/STORY-01-foundation-fixes.md) | Foundation fixes: typecheck + tracking wiring + empty state | P0 | 2h |
| [STORY-02](stories/STORY-02-homepage-rebuild.md) | Homepage rebuild — deal-first, top-6-niches curated | P0 | 6h |
| [STORY-03](stories/STORY-03-product-card-upgrade.md) | ProductCard upgrade — 1-click outbound + trust signals | P0 | 4h |
| [STORY-09](stories/STORY-09-brand-vn-tone.md) | Brand reframe — Vietnamese tagline + footer rewrite + About page | P0 | 3h |
| [STORY-10](stories/STORY-10-onboard-content-ops.md) | Onboard ops — pull 50 real products + 3 articles (operator work) | P0 | 4h |

### Phase 2: Conversion mechanics (làm money-machine hoàn chỉnh)

| Story | Tiêu đề | Priority | Estimate |
|---|---|---|---|
| [STORY-04](stories/STORY-04-niche-editorial.md) | Niche page editorial-first — H1 "Top X 2026" + comparison table top | P1 | 4h |
| [STORY-05](stories/STORY-05-mobile-nav.md) | Mobile-first header + sticky bottom nav | P1 | 3h |
| [STORY-06](stories/STORY-06-coupon-hub-v2.md) | Coupon hub v2 — countdown + stock + index page | P1 | 5h |

### Phase 3: Return-user + paid traffic (growth lever)

| Story | Tiêu đề | Priority | Estimate |
|---|---|---|---|
| [STORY-07](stories/STORY-07-deal-hot-landing.md) | Daily-deal landing `/deal-hot/<date>` cho FB ads | P2 | 5h |
| [STORY-08](stories/STORY-08-capture-subscribers.md) | Email + push capture + PriceWatch placeholder | P2 | 6h |

**Tổng:** 42h (~5-6 ngày dev tập trung) + 4h ops content onboarding (STORY-10 chạy song song).

---

## Dependency graph

```
STORY-01 (foundation) ─┬─► STORY-02 (homepage) ─┐
                       │                          ├─► STORY-04 (niche)
                       ├─► STORY-03 (card) ──────┤
                       │                          └─► STORY-06 (coupon v2)
                       └─► STORY-09 (brand) ─────► STORY-05 (mobile nav)

STORY-02 + STORY-03 ─► STORY-07 (deal-hot landing)
STORY-09 ─► STORY-08 (capture — needs About page + footer)

STORY-10 (ops content) chạy song song từ ngày 1, phụ thuộc nothing.
```

**Thứ tự đề xuất implement:**

1. **STORY-01** (2h) — đụng nhỏ, unblock build
2. **STORY-10** (kick off ops) — operator bắt đầu pull data Accesstrade song song
3. **STORY-09** (3h) — brand tone, nhanh, ảnh hưởng nhiều file
4. **STORY-03** (4h) — ProductCard upgrade, là building block cho STORY-02/04
5. **STORY-02** (6h) — homepage rebuild dùng ProductCard mới
6. **STORY-04** (4h) — niche page
7. **STORY-05** (3h) — mobile nav
8. **STORY-06** (5h) — coupon hub v2
9. **STORY-07** (5h) — deal-hot landing
10. **STORY-08** (6h) — capture + push

---

## Out of scope (sprint này KHÔNG làm)

- Đổi domain hoặc rename brand `dealvault → X` (business decision, separate ticket).
- Refactor AI extraction / article pipeline (vừa stable từ sprint trước).
- Compare widget interactive (`/so-sanh/<product-a>-vs-<product-b>`) — đẩy sang sprint sau.
- War Room admin KPI thật (placeholder ok).
- Real push notification send (chỉ infrastructure + subscribe flow; gửi thật ở sprint sau).
- Zalo OA bot integration (placeholder QR ok).
- Multi-language (chỉ VN tiếng Việt).
- A/B testing infrastructure.

## Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Operator chưa kịp pull đủ content cho STORY-02 demo | Med | STORY-10 kick off ngay ngày 1; nếu chậm thì fixtures script seed 20 demo product |
| Tracking action timeout=4s vẫn gây slow click | Low | Fallback direct affiliate URL khi quá 4s — user vẫn outbound, chỉ mất attribution row đó |
| Push notification permission UX kém → bị block | Med | Chỉ prompt sau visit 2 + sau khi user click ≥1 deal (signal of intent) |
| Daily-deal landing OG image cost cao | Low | Cache OG image edge cache 24h |
| Brand rename giữa sprint | Med | Hard-code `dealvault` qua 1 constant `BRAND_NAME` ở `lib/brand.ts`, rename = đổi 1 chỗ |

---

## Glossary

- **Trust signal** — element trên card/page làm user tin: store badge, verified-price date, rating sao, social proof count, "đã kiểm chứng".
- **Conversion path** — chuỗi click từ landing → outbound. Mục tiêu: ngắn nhất ≤2 click, không có deadend.
- **Above the fold** — phần thấy ngay khi load page, không scroll. Desktop 1440x900 = ~900px. Mobile 390x844 = ~700px (trừ status bar + URL bar).
- **Editorial-first niche** — niche page như bài báo: H1 có time-stamp + intro paragraph + comparison table top, không phải chỉ grid raw.
- **Return-user** — user quay lại site lần 2+ trong 30 ngày. Push + email + Zalo + price-watch là 4 channel.
- **Daily-deal landing** — page `/deal-hot/<date>` cho paid traffic FB ads. Stripped-down, mobile-only feel, 1-tap outbound.

---

## References

- Sprint trước: [at-source-of-truth](../at-source-of-truth/sprint.md) — backend pipeline foundation.
- Business context: [docs/CONTEXT.md](../../CONTEXT.md) — strategy "one micro-tool = one niche".
- AT integration: [docs/integrations/accesstrade.md](../../integrations/accesstrade.md) — API shape khi đụng tới crawler/reconciler.
- Web conventions: [apps/web/CLAUDE.md](../../../apps/web/CLAUDE.md) — RSC vs client, server actions, normalizeProduct.
- API conventions: [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) — admin auth pattern, Prisma usage, AiService.
