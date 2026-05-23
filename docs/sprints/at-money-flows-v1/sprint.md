# Sprint: AT Money Flows v1 — AT-driven money loops + admin gà mờ

**Sprint ID:** `at-money-flows-v1`
**Start:** 2026-05-23
**Target end:** 2026-06-20 (4 tuần)
**Owner:** @igapdev01
**Goal:** Biến Accesstrade từ "1 nguồn product feed" thành **6 money loop có chủ đích**, đồng thời gọn admin UX cho operator non-technical xài 5-7 phút/ngày. Zero new cron — tất cả manual qua 1 button "Đồng bộ tất cả".

---

## Quan hệ với sprint khác

| Sprint | Trạng thái | Quan hệ |
|---|---|---|
| [at-source-of-truth](../at-source-of-truth/sprint.md) | DONE | Cung cấp backbone: Campaign sync, crawler per-campaign, reconciler, coupon sync, top_products. Sprint này tận dụng những hook đó, KHÔNG refactor. |
| [vn-storefront-v2](../vn-storefront-v2/sprint.md) | ACTIVE (implementing) | Sprint này **bổ sung**, KHÔNG đè. Storefront-v2 lo UX user-facing (homepage, niche page, ProductCard, mobile nav, brand). Sprint này lo AT money mechanics + admin. Có 2 điểm chạm storefront (STORY-05 real-bestseller section + STORY-07 coupon-inline on ProductCard) — đã đánh dấu rõ trong story đó với cross-ref. |
| [blog-ai-authoring](../blog-ai-authoring/sprint.md) | DONE | Pipeline article generation. Sprint này thêm "wizard 1-form" cho operator (STORY-10) — chỉ là UI simplify, KHÔNG đụng pipeline. |

**Quy tắc no-overlap với vn-storefront-v2:**
- Sprint này KHÔNG đụng: `app/page.tsx` (homepage), `app/categories/`, `app/blog/`, `app/khuyen-mai/`, `components/product-card.tsx`, header/footer, mobile nav, brand tone.
- Sprint này CÓ đụng: `components/storefront/realbestseller-section.tsx` (NEW), `components/storefront/coupon-inline-pill.tsx` (NEW) — 2 component mới được mount vào storefront. Storefront-v2 chỉ thêm 1-2 dòng import.
- Mọi backend change (AT clients, services, models) là phạm vi sprint này, storefront-v2 không đụng backend.

---

## Vấn đề (problem statement)

### A. AT đang bị dùng vô tội

Code hiện chỉ dùng 5/12 endpoint AT:
- `datafeeds`, `campaigns`, `order-list`, `offers_informations/coupon`, `top_products`.

Bỏ phí 7 capability có giá trị tiền:
- `cashback/campaigns` (commission breakdown per merchant×subcategory)
- `offers_informations/keyword_list` (trending search keywords)
- `order-products` (sản phẩm thật user mua trong mỗi order)
- `product_link/create` (tạo tracking link cho URL bất kỳ với UTM tuỳ chỉnh)
- `transactions._extra.parameters.sub1-4` (multi-channel attribution)
- `transactions` device split (mobile/PC analytics)

Mỗi endpoint nếu dùng thông minh = **1 money loop**. Nếu dùng vô tội = tốn AT quota + ko thêm tiền.

### B. Multi-network code thừa cho AT-only operator

Codebase được thiết kế multi-network (Shopee/Lazada/TikTok direct + AT). Hiện tại owner ChỈ dùng AT:
- `shopee.client.ts` / `lazada.client.ts` / `tiktok.client.ts` — stub trả `not_implemented`
- `web-scrape.client.ts` — Playwright + Gemini fallback cho URL bất kỳ (power-tool dev, ko phải gà mờ feature)
- `Product.network` field — luôn `ACCESSTRADE`
- Network-specific webhook route — chỉ AT webhook fire thật
- `CRAWLER_ENABLED_NETWORKS` env gate — luôn `"accesstrade"`
- `niche-inference.util.ts` — đã `@deprecated` từ sprint trước, chưa xoá

Code thừa = nhiều surface để bug + admin UI phức tạp + gà mờ confused "tôi nên enable Shopee ko?".

### C. Cron 24/7 không phù hợp gà mờ + hosting tier rẻ

4 cron đang chạy (`@Cron` decorator NestJS):
- Crawler 6h
- Reconciler 30 phút
- Coupon sync 6h
- Top products 3h sáng

Vấn đề:
- Cron silent failure — gà mờ ko biết khi nào ngừng.
- Yêu cầu hosting tier 24/7 (Vercel serverless ko phù hợp).
- Timezone debug (must `Asia/Ho_Chi_Minh`).
- Gà mờ ko cảm thấy control — data tự đổi không hiểu vì sao.

Quyết định: **disable hết 4 cron, chuyển full-manual** qua 1 button "Đồng bộ tất cả" trên admin homepage. Code cron giữ nguyên (chỉ env flag off) → khi nào ready bật lại = đổi 1 dòng .env.

### D. Admin UI quá phức tạp cho gà mờ

Sidebar admin hiện có ≥10 menu top-level: Chiến dịch, Nhật ký lấy sản phẩm, Đối soát đơn, Xưởng prompt AI, Ngành hàng, Phân loại AT, Nguồn bán, Tên miền, Cửa hàng, Sản phẩm, Mã giảm giá, Bài viết.

Gà mờ:
- Không biết click vào đâu trước.
- Không biết "Prompt Studio" là gì.
- Không biết "Phân loại AT" khác "Ngành hàng" thế nào.
- Không biết hôm nay nên làm gì.

Cần: **4 nhóm sidebar + 1 dashboard có "việc cần làm" rõ ràng + 1 button "Đồng bộ" duy nhất**.

---

## Mục tiêu sprint

1. **Cleanup AT-only**: xoá 7 file/feature multi-network thừa.
2. **Zero new cron**: 4 backbone cron off, manual qua 1 button.
3. **Admin gà-mờ-first**: sidebar 4 nhóm, dashboard 7 widget, daily 5-7 phút ritual.
4. **6 money loop**: mỗi loop dùng AT có chủ đích, có metric riêng, có operator action rõ ràng.
5. **Refinery v2**: bulk + auto-approve high-confidence → operator approve 50 product trong 3-5 phút thay vì 25 phút.
6. **Article wizard 1-form**: operator chỉ điền topic + niche, AI chạy background, email khi xong.

## Outcomes đo được

| # | Outcome | Cách đo |
|---|---|---|
| 1 | Codebase ko còn reference `shopee/lazada/tiktok` client | Grep CI check |
| 2 | `CRAWLER_ENABLED + RECONCILE_ENABLED + COUPON_SYNC_ENABLED + TOP_PRODUCTS_ENABLED` = `false` mặc định | Verify .env.example |
| 3 | Admin homepage có **1 button** "Đồng bộ tất cả" chạy 4 backbone + Loop 1+2 fetch trong ≤3 phút | Manual click + chronometer |
| 4 | Sidebar admin có **4 nhóm** + collapse "Hệ thống nâng cao" | Visual screenshot |
| 5 | Admin dashboard có **7 widget** đúng spec (KPI, Việc cần làm, Cơ hội tuần, Tiền theo kênh, Link ngoài, Hệ thống, Thao tác nhanh) | Visual screenshot |
| 6 | Commission rank widget pull `/v1/cashback/campaigns` thật, hiện ≥5 hàng | API log + admin screenshot |
| 7 | Keyword radar widget hiện ≥5 keyword hot AT chưa có article | Admin screenshot |
| 8 | Order-products sync khi reconcile manual run — `OrderProduct` table có row | SQL count |
| 9 | Sub-IDs gắn vào aff_link (`sub1=<channel>`) cho mọi click | Browser devtool inspect outgoing URL |
| 10 | Money Trail có tab "Theo kênh" với ≥4 channel (organic/fb/zalo/email/direct) | Admin screenshot |
| 11 | ProductCard có coupon-inline pill khi có coupon matching merchant | Visual screenshot |
| 12 | Admin "Link ngoài site" tạo được tracking link từ URL Lazada bất kỳ qua AT API | Manual test |
| 13 | Refinery auto-approve áp dụng cho product có confidence ≥ rule | DB query before/after |
| 14 | Article wizard: 1-form submit → AI chạy background → admin notification khi xong | Manual flow test |

## Nguyên tắc bất di

- **HITL gate**: ko bypass `PENDING_REVIEW` cho product, `DRAFT` cho article. Auto-approve refinery có **rule rõ ràng** (confidence calc), KHÔNG phải "skip review".
- **trackingCode contract**: 32-char dashless uuid + `utm_source` giữ nguyên. Sub-IDs thêm vào aff_link là **bổ sung**, không thay thế.
- **Backbone cron code giữ nguyên**: chỉ env flag off. Bật lại = 1 dòng .env, ko cần code change.
- **AT rate-limit**: mọi endpoint AT giữ sleep ≥1s giữa request, retry exponential cho 429.
- **Zero new dependency package** trừ khi không tránh được. Ưu tiên dùng cái đã có (web-push, resend đã có hoặc deferred).

---

## Mental model — 6 money loop

```
                    ┌──────────────────────────────┐
                    │  AT API (12 endpoint)        │
                    └────────────────┬─────────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       │                             │                             │
   [Existing 5]                  [New 4]                       [Existing 2]
   datafeeds                     cashback/campaigns            (sub-IDs in
   campaigns                     keyword_list                    aff_link
   order-list                    order-products                  build, no
   coupon                        product_link/create             new endpoint)
   top_products
       │                             │                             │
       │                             │                             │
       ▼                             ▼                             ▼
   ┌──────────┐   ┌───────────────────────────────────────────────┐
   │ Backbone │   │           6 Money Loop                        │
   │ pipeline │   │                                               │
   │ (đã có)  │   │ Loop 1: "Hôm nay viết gì kiếm tiền nhất?"   │
   └──────────┘   │   → cashback/campaigns + keyword_list         │
                  │                                               │
                  │ Loop 2: "User mua gì thật?"                  │
                  │   → order-products hook reconcile             │
                  │                                               │
                  │ Loop 3: "Kênh nào sinh tiền?"                │
                  │   → sub-IDs + transactions._extra.sub1        │
                  │                                               │
                  │ Loop 4: "Coupon kế bên giá → click mạnh"    │
                  │   → coupon match merchantSlug render-time     │
                  │                                               │
                  │ Loop 5: "Đẩy link ra ngoài site"             │
                  │   → product_link/create on demand             │
                  │                                               │
                  │ Loop 6: "Coupon nóng → push (defer)"         │
                  │   → coupon expiresAt < 24h notify             │
                  └───────────────────────────────────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ Admin dashboard 7 widget — gà mờ    │
                  │ • KPI hôm qua/tháng                 │
                  │ • Việc cần làm (refinery + article) │
                  │ • Cơ hội tuần (Loop 1)              │
                  │ • Tiền theo kênh (Loop 3)           │
                  │ • Link ngoài site (Loop 5)          │
                  │ • Hệ thống (4 backbone last-sync)   │
                  │ • Thao tác nhanh                    │
                  └─────────────────────────────────────┘
```

Mỗi loop có:
- **1 endpoint AT chính** (ko mix nhiều endpoint khi ko cần).
- **1 trigger** (manual via "Đồng bộ tất cả", hoặc inline at click, hoặc render-time).
- **1 operator surface** (widget/page rõ ràng).
- **1 metric** đọc trong 5 giây.
- **1 money mechanism** cụ thể.

---

## Scope — 10 stories

### Phase 1 — AT cleanup + admin foundation

| Story | Tiêu đề | Priority | Estimate |
|---|---|---|---|
| [STORY-01](stories/STORY-01-at-only-cleanup.md) | AT-only cleanup — xoá multi-network code thừa | P0 | 3h |
| [STORY-02](stories/STORY-02-manual-sync-mode.md) | Manual sync mode — disable cron + "Đồng bộ tất cả" mega-button + last-sync status | P0 | 4h |
| [STORY-03](stories/STORY-03-admin-reorg.md) | Admin re-org — sidebar 4 nhóm + dashboard 7-widget home | P0 | 5h |

### Phase 2 — 6 money loops

| Story | Tiêu đề | Loop | Priority | Estimate |
|---|---|---|---|---|
| [STORY-04](stories/STORY-04-commission-keyword.md) | Commission rank + Keyword radar — "Cơ hội tuần" widget | Loop 1 | P0 | 5h |
| [STORY-05](stories/STORY-05-real-bestseller.md) | Real-bestseller — order-products sync + admin insight + storefront slot | Loop 2 | P0 | 5h |
| [STORY-06](stories/STORY-06-sub-ids-attribution.md) | Sub-IDs channel attribution — Money Trail "Theo kênh" | Loop 3 | P0 | 5h |
| [STORY-07](stories/STORY-07-coupon-inline.md) | Coupon-inline trên ProductCard — pill match merchant render-time | Loop 4 | P0 | 3h |
| [STORY-08](stories/STORY-08-link-ngoai-site.md) | Link ngoài site — TrackedLink table + product_link/create | Loop 5 | P0 | 4h |
| | Loop 6 (Coupon expiry push) | — | DEFER | — |

### Phase 3 — Admin operations efficiency

| Story | Tiêu đề | Priority | Estimate |
|---|---|---|---|
| [STORY-09](stories/STORY-09-refinery-v2.md) | Refinery v2 — bulk approve + auto-approve high-confidence | P0 | 5h |
| [STORY-10](stories/STORY-10-article-wizard.md) | Article wizard 1-form — operator điền topic + niche, AI bg, email notify | P1 | 4h |

**Tổng: 43h (~5-6 ngày dev tập trung).**

Loop 6 (coupon expiry push notify) DEFER vì cần ≥500 subscriber thật trước, và web-push send infrastructure setup riêng — đẩy sang sprint sau khi storefront-v2 STORY-08 email capture có data.

---

## Dependency graph

```
STORY-01 (AT cleanup) ──► STORY-02 (manual sync) ──► STORY-03 (admin re-org)
                                                              │
                              ┌───────────────────────────────┤
                              │                               │
                       STORY-04 (Loop 1)              STORY-09 (Refinery v2)
                       STORY-05 (Loop 2)              STORY-10 (Article wizard)
                       STORY-06 (Loop 3)
                       STORY-07 (Loop 4) ◄── cross-ref vn-storefront-v2 STORY-03 ProductCard
                       STORY-08 (Loop 5)

STORY-05 storefront slot ◄── cross-ref vn-storefront-v2 STORY-02 homepage rebuild
```

**Cross-ref với vn-storefront-v2:**

- **STORY-05** (real-bestseller storefront section): cần slot trong homepage để mount. Storefront-v2 STORY-02 homepage rebuild có section "🔥 Đang hot tuần này" — story này thay logic data đọc từ order-products. Nếu storefront-v2 STORY-02 chưa merge: ship admin part + storefront component standalone, storefront-v2 sẽ mount khi rebuild homepage.

- **STORY-07** (coupon-inline ProductCard): cần render slot trong ProductCard. Storefront-v2 STORY-03 có ProductCard upgrade. Story này thêm 1 component `CouponInlinePill` mount vào card. Nếu storefront-v2 STORY-03 chưa merge: ship component standalone + 1 PR nhỏ thêm import vào ProductCard hiện tại.

**Thứ tự implement đề xuất:**

1. STORY-01 → 02 → 03 (foundation, không đụng storefront)
2. Sau đó parallel: STORY-04, 05, 06, 08, 09, 10 (đa số admin/backend)
3. STORY-07 cuối — đợi storefront-v2 STORY-03 ProductCard rồi mount

---

## Out of scope (sprint này KHÔNG làm)

- Push notification real send (defer — cần subscriber thật).
- Email digest cron + Resend integration (defer — operator chưa cần).
- Brand rename (`dealvault` → X) — vẫn là business decision.
- Refactor article generation pipeline (vừa stable từ sprint blog-ai-authoring).
- War Room admin dashboard (placeholder OK, sprint sau).
- Multi-language.
- Compare widget interactive (`/so-sanh/<a>-vs-<b>`).

## Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| AT rate-limit khi "Đồng bộ tất cả" pull 4-5 endpoint cùng lúc | Med | Sleep 1.5s giữa endpoint + retry exponential. Pull tuần tự không parallel. |
| Operator quên click "Đồng bộ" 7 ngày | Med | Banner đỏ trên admin "Đã X ngày chưa sync — site có thể stale" + email reminder daily 9h sáng (cron đơn giản, ko đụng AT) |
| Storefront-v2 chưa merge ProductCard upgrade → coupon-inline pill (STORY-07) ko mount | Low | Component standalone, có thể mount qua 1 PR nhỏ vào ProductCard hiện tại |
| `cashback/campaigns` response shape khác `campaigns` → confuse | Low | Doc shape kỹ trong STORY-04 + test với curl thật trước khi code |
| `order-products` thiếu `merchant` param → 400 | Low | Doc rõ trong STORY-05 + fallback skip nếu thiếu |
| Auto-approve refinery duyệt nhầm product xấu | Med | Confidence rule chặt: ảnh + giá + Mall badge + discount ≥15. Operator vẫn có thể "Bỏ duyệt" trong 24h |

---

## Glossary

- **Money loop** — chuỗi data → operator action → revenue impact. Mỗi loop dùng 1 AT endpoint chính.
- **Đồng bộ tất cả** — mega-button trên admin homepage chạy 4 backbone + Loop 1+2 fetch tuần tự, mất 2-3 phút.
- **Last-sync status** — widget hiển thị "Crawler chạy 14:00 (cách 6h)" cho 4 backbone, đỏ nếu > 2× tần suất kỳ vọng.
- **Confidence score** — số 0-100 tính từ product features (có image, có price, có Mall badge, discount ≥15, etc.) dùng cho auto-approve refinery.
- **Channel** — nguồn traffic tới click outbound: `organic` (SEO), `fb` (Facebook ad/post), `zalo`, `email`, `direct` (ko detect được).
- **Sub-IDs** — `sub1, sub2, sub3, sub4` AT-provided param gắn vào aff_link để carry attribution.
- **TrackedLink** — link tracking AT tạo cho URL ngoài datafeed (operator paste URL → AT generate aff_link).

## References

- [Sprint at-source-of-truth](../at-source-of-truth/sprint.md) — backbone pipeline foundation
- [Sprint vn-storefront-v2](../vn-storefront-v2/sprint.md) — storefront UX rebuild (đang implement song song)
- [AT integration doc](../../integrations/accesstrade.md) — chi tiết shape mọi endpoint AT
- [docs/CONTEXT.md](../../CONTEXT.md) — business context strategy
- [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) — backend conventions
- [apps/web/CLAUDE.md](../../../apps/web/CLAUDE.md) — frontend conventions
