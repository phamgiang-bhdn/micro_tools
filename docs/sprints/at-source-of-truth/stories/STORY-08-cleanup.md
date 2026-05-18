# STORY-08 — Cleanup: xoá inferCategorySlug, env cũ, doc final

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 2h
**Dependencies:** [STORY-03](STORY-03-per-campaign-crawler.md) (path crawler không còn dùng inferCategorySlug) + [STORY-04](STORY-04-onboard-ui.md) (admin có UI để re-onboard nếu cần). Recommended: chạy sau khi tất cả Phase 2 đã merge.

## Context

Sau khi STORY-03 refactor crawler sang per-campaign mode (category lấy từ `Campaign.categoryId`), các artifact cũ trở thành dead code:

1. **[category-inference.util.ts](../../../../apps/api/src/modules/crawler/category-inference.util.ts)** — keyword map 5 niche cứng. Chỉ còn `web-scrape.client.ts` dùng (path paste URL tay).
2. **`CRAWLER_MIN_DISCOUNT_PERCENT` env** — đã thay bằng `Campaign.filterRules.minDiscountPercent`.
3. **`Campaign.externalId` (slug-based)** — đã có `atCampaignId` thật từ STORY-02. `externalId` chỉ còn nghĩa trên row legacy chưa backfill.
4. **`ImportService.resolveCampaignId`** — chỉ còn fallback cho web-scrape path.
5. **Doc tham chiếu** cần update: nhiều chỗ trong CLAUDE.md, CONTEXT.md vẫn mô tả mô hình cũ.

Story này dọn dẹp cẩn thận — KHÔNG xoá triệt để nếu còn nguy cơ break. Nguyên tắc: **xoá dead-on-arrival; deprecate-mark dead-soon-but-still-touched.**

## User story

> **As** dev maintain repo,
> **I want** code không có dead path/env/comment lừa người đọc,
> **so that** AI agent + human dev tương lai không nhầm khi đọc.

## Acceptance criteria

### AC1 — Audit `inferCategorySlug` usage

Chạy grep:
```bash
grep -rn "inferCategorySlug" apps/api/src
```

Expected callers sau STORY-03:
- `web-scrape.client.ts` (path paste URL — vẫn cần)
- (Có thể) tests

KHÔNG còn caller từ crawler-cycle path (`crawler.service.ts`, `accesstrade.client.ts`).

**Quyết định**:
- Giữ file `category-inference.util.ts` vì còn web-scrape dùng.
- Thêm JSDoc top file ghi rõ scope đã thu hẹp:
  ```ts
  /**
   * @deprecated for crawler-cycle path (use Campaign.categoryId instead).
   * Only used by web-scrape.client.ts (paste URL fallback) — admin truyền categorySlug tay là path chính.
   * Keyword table chưa cập nhật theo niche v1; nếu paste URL không match niche, sẽ rơi vào DEFAULT_CATEGORY_SLUG = sai.
   * Khi quyết định không cần web-scrape inference nữa → xoá toàn file.
   */
  ```
- KHÔNG sửa keyword table (đã ngoài scope crawler-cycle, không ảnh hưởng pipeline chính).

### AC2 — Xoá `CRAWLER_MIN_DISCOUNT_PERCENT` env

File: [apps/api/.env.example](../../../../apps/api/.env.example)
- Xoá dòng `CRAWLER_MIN_DISCOUNT_PERCENT=20`.

File: [apps/api/src/modules/crawler/crawler.service.ts](../../../../apps/api/src/modules/crawler/crawler.service.ts)
- Verify không còn đọc `process.env.CRAWLER_MIN_DISCOUNT_PERCENT` (STORY-03 đã xoá usage, kiểm tra lại).

Doc: [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md) section Env
- Xoá mô tả `CRAWLER_MIN_DISCOUNT_PERCENT`.
- Thêm note: "Min discount giờ per-campaign trong `Campaign.filterRules.minDiscountPercent`."

### AC3 — Đánh dấu `Campaign.externalId` deprecated

File: [apps/api/prisma/schema.prisma](../../../../apps/api/prisma/schema.prisma)

Thêm comment trên field:
```prisma
model Campaign {
  // ...
  /// @deprecated dùng atCampaignId thay thế. Giữ để backward compat với row legacy
  /// (campaign tạo trước STORY-02, externalId = slugify(name)).
  /// Khi tất cả campaign đã backfill atCampaignId → có thể drop field này.
  externalId      String
  // ...
}
```

KHÔNG drop column ở story này — cần migration riêng + verify zero data dependency.

### AC4 — Deprecate-mark `ImportService.resolveCampaignId`

File: [apps/api/src/modules/crawler/import.service.ts](../../../../apps/api/src/modules/crawler/import.service.ts)

Thêm JSDoc:
```ts
/**
 * @deprecated path crawler-cycle đã set campaignDbId từ Campaign.id trực tiếp (STORY-03).
 * Method này chỉ còn dùng cho fallback web-scrape (paste URL không có context campaign).
 * Tạo campaign theo slug name không có atCampaignId — admin phải re-sync để link với AT.
 */
private async resolveCampaignId(...) { ... }
```

### AC5 — Drop columns không dùng (cân nhắc kỹ)

**KHÔNG drop ở story này**. Để migration tách:
- `Campaign.externalId` → có thể drop sau khi 100% campaign có `atCampaignId`.
- `Coupon.code` UNIQUE constraint → có thể thay bằng `atCouponId` UNIQUE.

Tạo file `docs/sprints/at-source-of-truth/FUTURE-DROPS.md` ghi lại để team tương lai biết:

```markdown
# Cleanup queue (defer)

Sau khi sprint at-source-of-truth merge, các field/constraint sau có thể drop:

## Campaign.externalId
- Đã có atCampaignId thay thế.
- Trigger drop: khi `SELECT COUNT(*) FROM "Campaign" WHERE "atCampaignId" IS NULL = 0`.

## CRAWLER_ENABLED_NETWORKS env
- Multi-network skeleton đang giữ; nếu chắc chắn chỉ Accesstrade vĩnh viễn → drop env + xoá Shopee/Lazada/TikTok clients.
- Trigger: 6 tháng sau launch v1 mà không onboard direct integration.

## inferCategorySlug + DEFAULT_CATEGORY_SLUG
- Phụ thuộc vào web-scrape path.
- Trigger drop: khi confirm web-scrape không còn dùng (admin luôn dùng UI assign campaign + crawler-cycle).
```

### AC6 — Update [CLAUDE.md](../../../../apps/api/CLAUDE.md) toàn diện

Sửa các section:

**Crawler**:
- Thay "Free-text → categorySlug mapping" bằng mô tả mới: "Campaign.categoryId quyết định category cho mọi product crawl được."
- Xoá đề cập `CRAWLER_MIN_DISCOUNT_PERCENT`.
- Thêm: "Filter rules per-campaign lưu trong `Campaign.filterRules` (JSON, validated bằng `filterRulesSchema`)."

**Campaigns**:
- Thay "auto-create" mô tả slug-based bằng: "Campaign sync từ `/v1/campaigns` (STORY-02). `atCampaignId` là khoá ổn định."
- Thêm: "Một Category gom nhiều Campaign — quan hệ 1:N qua `Campaign.categoryId`."

**Reconciliation** (section mới):
- Mô tả ReconciliationService + cron 30 phút.

**Coupons** (section mới):
- Mô tả CouponSyncService + flow HITL.

**Top Products** (section mới):
- Mô tả TopProductsSyncService + snapshot per day.

### AC7 — Update [CONTEXT.md](../../../docs/CONTEXT.md)

Read CONTEXT.md, tìm chỗ mô tả crawler/category flow → update.

Đặc biệt section "Categories và Products" + "Pipeline":
- Đổi mental model: AT là upstream, Category là layer view.
- HITL philosophy không đổi (vẫn là bất di).

### AC8 — Update [docs/integrations/accesstrade.md](../../../integrations/accesstrade.md)

Final pass:
- Tất cả endpoint đã implement → đánh dấu "(đang dùng)".
- Section 5 (Mapping) cập nhật đầy đủ: `Campaign.atCampaignId`, `ConversionWebhook.atOrderId`, `Coupon.atCouponId`, `TopProductSnapshot.atProductId`.
- Section 6 (Gotcha) #10 (`discount` ambiguous): "✅ Đã fix ở STORY-03".

### AC9 — Tạo MIGRATION-NOTES.md

File mới: `docs/sprints/at-source-of-truth/MIGRATION-NOTES.md`

```markdown
# Migration notes — AT Source of Truth sprint

Đọc trước khi deploy sprint này lên prod (chưa cần vì web chưa release).

## Required env mới
- `RECONCILE_ENABLED=true`
- `RECONCILE_CRON="*/30 * * * *"`
- `COUPON_SYNC_ENABLED=true`
- `COUPON_SYNC_CRON="0 */6 * * *"`
- `TOP_PRODUCTS_ENABLED=true`
- `TOP_PRODUCTS_CRON="0 3 * * *"`

## Env xoá
- `CRAWLER_MIN_DISCOUNT_PERCENT` (đã chuyển vào filterRules per-campaign)

## Migration order
1. Run `npm run db:deploy` (apply 4 migrations mới: schema extension, reconciliation, coupon_extension, top_products).
2. Restart api — scheduler mới sẽ tự khởi động.
3. Admin login → /admin/campaigns → bấm "Sync from Accesstrade" → đợi xong.
4. Admin assign mỗi campaign vào Category (cũ hoặc tạo mới) — phần này có thể làm dần, không cần xong ngay.
5. Verify crawler-cycle chạy: log thấy "Campaign X: fetched N" per campaign đã assign.
6. Verify reconciler chạy (30 phút sau): log "Reconciliation cycle started".

## Rollback strategy
Nếu schema migration fail:
- 4 migration mới chỉ ADD COLUMN/TABLE, không DROP. Có thể rollback bằng `prisma migrate resolve --rolled-back <migration_name>`.
- Code mới chỉ ADD path (crawler-cycle per-campaign), KHÔNG xoá path cũ ngay. `web-scrape.client.ts` path vẫn dùng inferCategorySlug.

## Backfill campaign legacy
Trước sprint này có campaign tạo bằng slug-based externalId. Cần backfill `atCampaignId`:
- Cách 1 (auto): chạy sync (STORY-02). Sync sẽ tạo Campaign mới với atCampaignId; admin merge tay trong /admin/campaigns (hoặc SQL):
  ```sql
  UPDATE "Campaign" old
  SET "atCampaignId" = new."atCampaignId"
  FROM "Campaign" new
  WHERE old."externalId" = LOWER(REPLACE(new."name", ' ', '-'))
    AND old."atCampaignId" IS NULL
    AND new."atCampaignId" IS NOT NULL;
  ```
- Cách 2 (manual): admin xoá Campaign cũ (sau khi đảm bảo không có Product/Conversion link) + sync lại.

## Smoke test post-deploy
- [ ] Tạo 1 click trên product → ClickLog có trackingCode.
- [ ] Trigger webhook giả: `POST /webhooks/conversion` → ConversionWebhook record với `source: "webhook"`.
- [ ] Đợi 30 phút (hoặc gọi `POST /admin/reconciliation/run`) → ConversionWebhook record giờ có `source: "both"`.
- [ ] Verify table có data: Campaign (>0), Product (>0), Coupon (>0 nếu merchant match), TopProductSnapshot (>0 sau cron 3am).
```

### AC10 — Final smoke test

End-to-end manual test, ghi steps vào MIGRATION-NOTES.md:

1. Bắt đầu DB sạch (drop + bootstrap).
2. Set env AT thật.
3. Admin sync campaigns → thấy ≥1 campaign.
4. Admin assign 1 campaign vào "Robot hút bụi lau nhà" category với filterRules `{minDiscountPercent: 20, status_discount: 1}`.
5. Trigger crawler manual → thấy product chảy vào DB.
6. Vào /admin/refinery → approve 1 product.
7. Vào storefront `/categories/robot-hut-bui-lau-nha` → thấy product.
8. Click product → trackingCode generated → redirect AT.
9. Đợi 30 phút (hoặc giả lập): trigger reconcile manual → log không error.
10. Vào /admin/money-trail → thấy revenue (nếu có webhook giả) với badge "both".

## Technical breakdown

### Files mới
- `docs/sprints/at-source-of-truth/MIGRATION-NOTES.md`
- `docs/sprints/at-source-of-truth/FUTURE-DROPS.md`

### Files sửa
- `apps/api/.env.example` — xoá env cũ.
- `apps/api/src/modules/crawler/category-inference.util.ts` — JSDoc deprecate-mark.
- `apps/api/src/modules/crawler/import.service.ts` — JSDoc deprecate-mark `resolveCampaignId`.
- `apps/api/prisma/schema.prisma` — comment trên `externalId`.
- `apps/api/CLAUDE.md` — update toàn diện section Crawler/Campaigns + section mới.
- `docs/CONTEXT.md` — update mental model.
- `docs/integrations/accesstrade.md` — final pass mark "(đang dùng)" + gotcha update.

### Files KHÔNG sửa
- Không drop schema column nào.
- Không xoá file `.ts` nào.
- Không sửa logic — chỉ doc + comment.

## Definition of Done

- [ ] `grep -rn "CRAWLER_MIN_DISCOUNT_PERCENT" apps/` → 0 match trong code (chỉ có trong git history).
- [ ] `grep -rn "inferCategorySlug" apps/api/src/modules/crawler/crawler.service.ts` → 0 match (verify STORY-03 đã sạch).
- [ ] `apps/api/CLAUDE.md` đọc kỹ — không còn câu nào lỗi thời (vd "auto-create campaign từ slug" hoặc "min discount global").
- [ ] `docs/CONTEXT.md` mental model "Pipeline" reflect kiến trúc mới.
- [ ] `docs/integrations/accesstrade.md` tất cả endpoint implemented đã đánh dấu "(đang dùng)".
- [ ] MIGRATION-NOTES.md có smoke test steps + rollback strategy.
- [ ] `npm run build` pass (smoke check sau cleanup không ai accidental break).
- [ ] Commit cuối sprint: "chore: at-source-of-truth sprint cleanup + docs".

## Out of scope

- **Drop column thực sự**: defer. Sẽ làm sprint sau khi confirm data ổn.
- **Xoá Shopee/Lazada/TikTok client stubs**: keep cho future.
- **Refactor `web-scrape.client.ts` để bỏ inferCategorySlug**: web-scrape là path tay, admin truyền `categorySlug` rõ ràng → inference vẫn hữu ích làm fallback. Giữ.

## Notes cho AI agent

- **Cleanup story là tinh tế nhất sprint**. Đừng xoá hùng hổ. Nguyên tắc: comment trước, drop sau. Một xoá nhầm hôm nay → bug 3 tháng sau khó dò.
- **Đọc các file cẩn thận trước khi sửa**: doc CLAUDE.md có nhiều section dài, không scroll bừa. Mỗi section liên quan crawler/campaigns phải cập nhật cụ thể.
- **Git history**: commit message rõ "chore: cleanup post AT-first refactor — no logic change". Reviewer sẽ chỉ skim diff.
- **MIGRATION-NOTES.md là tài liệu sống**: prep cho deploy thật. Đọc cách CONTEXT.md + sprint.md viết, follow tone.
- **`@deprecated` JSDoc tag** thật sự được TS/IDE đọc — sẽ underline khi caller dùng. Hữu ích.
- **Đừng đụng test cũ**: không có test cho `category-inference.util.ts` ở repo này (sole spec là `app.module.spec.ts`); không cần thêm/xoá.
