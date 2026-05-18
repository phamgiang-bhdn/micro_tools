# Sprint: Accesstrade Source of Truth (AT-first architecture)

**Sprint ID:** `at-source-of-truth`
**Start:** 2026-05-16
**Target end:** 2026-05-30 (2 tuần)
**Owner:** @igapdev01

---

## Vấn đề (problem statement)

Kiến trúc hiện tại được thiết kế "Category-first": admin define niche trong [seed.js](../../../apps/api/prisma/seed.js) trước, crawler cố infer category cho mỗi offer Accesstrade trả về qua [category-inference.util.ts](../../../apps/api/src/modules/crawler/category-inference.util.ts). Dẫn đến 4 vấn đề:

1. **Mapping lệch**: keyword map trả về slug `tech-gadgets`/`home-appliances`/... nhưng seed v1 chỉ có `robot-hut-bui-lau-nha` + `may-loc-khong-khi` → `ImportService` skip 100% offer.
2. **Không có `campaign_id` thật**: `Campaign.externalId = slugify(name)` ([import.service.ts:119](../../../apps/api/src/modules/crawler/import.service.ts#L119)) vì `/v1/datafeeds` không trả id. Đổi tên campaign bên AT = tạo row mới, không sync trạng thái duyệt được.
3. **Filter global cứng**: `CRAWLER_MIN_DISCOUNT_PERCENT=20` áp cho toàn pool, không tinh chỉnh được theo merchant (Shopee deal sâu hơn FPT Shop chẳng hạn).
4. **Revenue có thể miss**: chỉ phụ thuộc webhook ([webhooks.controller.ts](../../../apps/api/src/modules/webhooks/webhooks.controller.ts)), không có ground-truth reconcile từ AT.

Web chưa release → tự do refactor schema + flow nghiệp vụ.

## Mục tiêu sprint

Đảo ngược chiều dữ liệu: **Accesstrade thành upstream chính, Category trở thành "presentation layer"** map từ 1+ Campaign sang slug/SEO. Đồng thời mở rộng coverage sang reconciliation, coupon, top products.

## Outcomes đo được

- Admin onboard 1 niche mới = apply campaign trong AT dashboard + 2 click trong `/admin/campaigns` (chọn campaign + assign to category). **KHÔNG cần đụng code/seed.**
- 1 Category public có thể gom nhiều Campaign từ nhiều merchant — so sánh giá cross-merchant cho cùng niche.
- Filter rules per-campaign: `minDiscountPercent`, `domains[]`, `priceMin/Max` lưu trong DB, không phải env.
- Revenue được reconcile từ `/v1/order-list` mỗi 30 phút — webhook miss không mất doanh thu.
- Coupon flow từ `/v1/offers_informations/coupon` → public route `/khuyen-mai/<merchant>`.
- Code `inferCategorySlug` bị xoá (hoặc giáng thành fallback). `CRAWLER_MIN_DISCOUNT_PERCENT` env bị xoá.

## Nguyên tắc bất di

- **HITL gate giữ nguyên**: product mới từ crawler vẫn vào `ProductExtraction.status = PENDING_REVIEW`. Coupon mới vào `Coupon.isActive = false` chờ admin duyệt.
- **Backward compatibility với data cũ**: products đã tồn tại không bị mất. Migration chỉ thêm field, không drop. Campaign cũ (externalId = slug) được migrate sang `atCampaignId` nếu match được.
- **Doc thật, không bịa**: bất cứ shape API nào dùng phải khớp [docs/integrations/accesstrade.md](../../integrations/accesstrade.md). Nếu doc thiếu → curl thử thật, đừng đoán.
- **Webhook real-time vẫn chạy**: reconciler không thay webhook, chỉ là backup ground-truth.

## Mental model mới

```
[Accesstrade]                      ← Pool data thô (không control structure)
     ↓ sync (auto cron)
[Campaign + Product raw]           ← Mirror trong DB, 1-1 với AT
     ↓ filter rules + admin curate
[Category view + Product public]   ← Layer trình bày: branding, SEO, niche
     ↓ HITL approve
[Storefront]                       ← User thấy
```

## Scope — 8 stories

### Phase 1: Core refactor (sequential)

| Story | Tiêu đề | Estimate |
|---|---|---|
| [STORY-01](stories/STORY-01-schema-migration.md) | Schema migration: Campaign extension + Category↔Campaign relation | 3h |
| [STORY-02](stories/STORY-02-campaign-sync.md) | Sync campaigns từ `/v1/campaigns?approval=successful` | 4h |
| [STORY-03](stories/STORY-03-per-campaign-crawler.md) | Crawler per-campaign loop + filter rules | 5h |
| [STORY-04](stories/STORY-04-onboard-ui.md) | Admin UI: onboard campaign → assign category + edit filter | 6h |

### Phase 2: Parallel additions

| Story | Tiêu đề | Estimate |
|---|---|---|
| [STORY-05](stories/STORY-05-reconciliation.md) | Reconciliation poller (`/v1/order-list` → ConversionWebhook) | 6h |
| [STORY-06](stories/STORY-06-coupon-sync.md) | Coupon sync (`/v1/offers_informations/coupon` → Coupon) | 5h |
| [STORY-07](stories/STORY-07-top-products.md) | Top products carousel homepage | 3h |

### Phase 3: Cleanup

| Story | Tiêu đề | Estimate |
|---|---|---|
| [STORY-08](stories/STORY-08-cleanup.md) | Xoá inferCategorySlug + env cũ + doc update | 2h |

**Tổng: ~34h work.** Realistically 9-10 ngày cho 1 dev.

## Thứ tự thực thi đề xuất

```
STORY-01 (schema) ──┐
                    ├──> STORY-02 (sync campaigns) ──> STORY-03 (per-campaign crawl) ──> STORY-04 (onboard UI)
                    │                                                                          │
                    ├──> STORY-05 (reconciliation) ─────────────────────────────────────────────┤
                    │                                                                          │
                    ├──> STORY-06 (coupon)         ─────────────────────────────────────────────┤
                    │                                                                          │
                    └──> STORY-07 (top products)   ─────────────────────────────────────────────┤
                                                                                               │
                                                                                STORY-08 (cleanup)
```

STORY-01 là blocker duy nhất. Sau STORY-01, có thể parallel hoá 02/05/06/07. STORY-03 depends 02. STORY-04 depends 03. STORY-08 cuối cùng, depends 03+04.

## Rủi ro & mitigation

| Rủi ro | Mitigation |
|---|---|
| Migration schema break product cũ (foreign key) | Tất cả field mới đều nullable; chỉ thêm relation, không drop column |
| AT `/v1/campaigns` trả khác doc | Curl test thật trước khi viết client; lưu raw response vào `Campaign.atRawData` để debug |
| Mapping campaign cũ (slug-based) → mới (id-based) thất bại | Script migration interactive: list candidates, admin xác nhận thủ công cho ambiguous case |
| Rate limit `/v1/order-list` (10 req/min) khi backfill lịch sử | Backfill chia batch theo ngày, sleep 7s giữa request |
| Filter rules JSON schema phình to | Define zod schema cứng, validate ở admin endpoint trước khi lưu |
| Admin UI onboard rối khi có 50+ campaign | UI list có filter status + search merchant; default chỉ show "chưa assigned" |
| Coupon volume lớn (Shopee có 7480 offers/day) | Per-merchant limit pull (50 mới nhất); cron 6h thay vì real-time |
| Reconciler tạo ConversionWebhook giả nếu webhook không tồn tại (no trackingCode) | Reconciler chỉ UPDATE existing, không tạo mới — log warning để admin biết webhook miss |

## Định nghĩa "Done" của sprint

- [ ] Tất cả 8 story merged + có integration test cơ bản.
- [ ] `npm run build` pass (web + api).
- [ ] `npm run test:api` pass.
- [ ] Test smoke: onboard 1 campaign mới qua UI → product chảy vào DB → review trong Refinery → publish → click → conversion → reconcile.
- [ ] [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) + [docs/CONTEXT.md](../../CONTEXT.md) + [docs/integrations/accesstrade.md](../../integrations/accesstrade.md) updated phản ánh kiến trúc mới.
- [ ] [docs/sprints/at-source-of-truth/MIGRATION-NOTES.md](MIGRATION-NOTES.md) viết hướng dẫn run migration prod (khi nào release thật).

## Quy ước story

Mỗi story file theo template:
- **Context** — vì sao story này tồn tại, đọc xong cold biết mục đích
- **User story** — As / I want / So that
- **Acceptance criteria** — bullet, có thể verify được, ghi rõ file/path/field
- **Technical breakdown** — file paths cần sửa, code patterns reference các file đã có trong repo
- **Schema changes** — Prisma diff nếu có
- **API contract** — endpoint shape nếu có thêm/sửa
- **Dependencies** — story khác phải merge trước
- **Definition of Done** — checklist verify
- **Out of scope** — ngăn scope creep
- **Estimate** — giờ work

## Tài liệu tham chiếu bắt buộc

Bất kỳ AI agent nào pick story này lên cần đọc trước:

1. [docs/CONTEXT.md](../../CONTEXT.md) — chiến lược nghiệp vụ + HITL philosophy.
2. [docs/integrations/accesstrade.md](../../integrations/accesstrade.md) — shape/quirk của từng endpoint AT.
3. [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) — convention backend (auth, prisma, validation pattern).
4. [apps/web/CLAUDE.md](../../../apps/web/CLAUDE.md) — convention frontend (admin UI patterns, server actions).
5. [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — schema hiện tại.

Không đọc 1-3 = chắc chắn sai pattern. Convention repo này khắt khe (per-method auth, zod ở admin vs class-validator ở public, server actions không trực tiếp gọi Prisma...).
