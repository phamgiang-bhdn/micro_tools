# Migration notes — AT Source of Truth sprint

Đọc trước khi deploy sprint này (v1 web chưa release nên hiện chưa cần — note này prep cho lần deploy thật).

## Migrations mới (apply theo thứ tự `db:deploy`)

1. `20260516153000_at_first_schema_extension` (STORY-01) — Campaign + Coupon AT fields.
2. `20260516160000_reconciliation` (STORY-05) — `ReconciliationLog` + `ConversionWebhook` reconcile fields.
3. `20260516170000_coupon_extension` (STORY-06) — Coupon AT sync fields + Campaign FK.
4. `20260516180000_top_products` (STORY-07) — `TopProductSnapshot`.

Tất cả migration chỉ `ADD COLUMN/TABLE/INDEX`, KHÔNG `DROP` — rollback an toàn bằng `prisma migrate resolve --rolled-back <name>`.

## Env mới (cập nhật `apps/api/.env`)

```bash
# Reconciliation poller (STORY-05)
RECONCILE_ENABLED=true
RECONCILE_CRON="*/30 * * * *"

# Coupon sync (STORY-06)
COUPON_SYNC_ENABLED=true
COUPON_SYNC_CRON="0 */6 * * *"

# Top products snapshot (STORY-07)
TOP_PRODUCTS_ENABLED=true
TOP_PRODUCTS_CRON="0 3 * * *"
```

## Env xoá

- `CRAWLER_MIN_DISCOUNT_PERCENT` — discount threshold giờ per-campaign trong `Campaign.filterRules.minDiscountPercent`. Xoá khỏi `.env` (đã xoá khỏi `.env.example` ở STORY-08).

## Dependencies

- `apps/api/package.json` thêm `sanitize-html` + `@types/sanitize-html` (STORY-06 dùng để sanitize coupon `contentHtml`). `npm install` ở root sẽ kéo về.

## Migration order khi deploy

1. `git pull` → `npm install` (kéo `sanitize-html`).
2. Update `apps/api/.env` với env mới ở trên; xoá `CRAWLER_MIN_DISCOUNT_PERCENT`.
3. `npm run db:deploy` — apply 4 migration mới.
4. Restart api: `npm run dev:api` (hoặc deploy pipeline) — scheduler mới (reconciliation, coupon-sync, top-products) tự khởi động.
5. Restart web: `npm run dev:web` để pick up `/khuyen-mai/[merchantSlug]` route + homepage section.
6. Admin login → `/admin/campaigns` → bấm **Sync from Accesstrade** → đợi xong (phụ thuộc rate limit AT, có thể vài phút).
7. Admin assign mỗi campaign vào Category (cũ hoặc tạo mới qua dialog). Có thể làm dần — chỉ campaign nào assigned mới được crawler-cycle pick up.
8. Verify crawler-cycle log thấy "Campaign X: fetched N" per campaign approved.
9. Verify reconciler chạy (30 phút sau, hoặc gọi tay `POST /admin/reconciliation/run`) → log "Reconciliation cycle".
10. Verify coupon sync (chỉ chạy nếu có Campaign approved với merchantName match AT login_name; gọi tay `POST /admin/coupons/sync-from-at` để test) — coupon mới sẽ là `isActive=false` chờ admin duyệt.
11. Verify top-products: chạy tay `POST /admin/top-products/sync` để khỏi đợi 3am — homepage có section "🔥 Đang hot tuần này".

## Backfill Campaign legacy

Campaign tạo trước sprint có `externalId = slugify(name)`, `atCampaignId = NULL`. Sau khi sync (bước 6):

- **Cách 1 (auto, có thể trùng)**: Sync sẽ tạo Campaign mới với cùng `merchantName`/`name` nhưng `atCampaignId` set. Admin merge tay bằng SQL:
  ```sql
  UPDATE "Campaign" old
  SET "atCampaignId" = new."atCampaignId",
      "atLastSyncedAt" = new."atLastSyncedAt"
  FROM "Campaign" new
  WHERE old."externalId" = LOWER(REPLACE(new."name", ' ', '-'))
    AND old."atCampaignId" IS NULL
    AND new."atCampaignId" IS NOT NULL;
  -- Sau đó xoá row mới (tránh duplicate):
  DELETE FROM "Campaign"
  WHERE "atCampaignId" IS NOT NULL
    AND "id" IN (
      SELECT "id" FROM "Campaign"
      WHERE "atCampaignId" IS NOT NULL
      EXCEPT
      SELECT MIN("id") FROM "Campaign" GROUP BY "atCampaignId"
    );
  ```
- **Cách 2 (manual, recommended nếu < 10 campaign)**: trong `/admin/campaigns`, ẩn campaign cũ (`status=INACTIVE`); admin assign campaign mới (synced) vào Category. Product cũ vẫn link campaign cũ — không break storefront (Product.campaignId nullable + SetNull).

## Rollback strategy

Nếu schema migration fail giữa chừng:

1. `prisma migrate resolve --rolled-back <migration_name>` cho migration lỗi.
2. Manually drop column/table được apply một phần (kiểm tra `_prisma_migrations` table + so với `migration.sql`).
3. Code mới chỉ ADD path. Cron mới sẽ no-op nếu env tắt; web-scrape path cũ vẫn dùng `inferCategorySlug` fallback.
4. Set `RECONCILE_ENABLED=false`, `COUPON_SYNC_ENABLED=false`, `TOP_PRODUCTS_ENABLED=false` để tắt cron mới mà không cần revert code.

## Smoke test post-deploy

- [ ] Click 1 product trên storefront → `ClickLog` có `trackingCode` 32 ký tự, không dấu gạch.
- [ ] Trigger webhook giả: `POST /api/v1/webhooks/conversion` với cùng `trackingCode` → `ConversionWebhook` row mới, `source = "webhook"`.
- [ ] Đợi 30 phút (hoặc gọi `POST /api/v1/admin/reconciliation/run`) → `ConversionWebhook.source = "both"`, `atOrderId` set.
- [ ] `/admin/money-trail` filter "Chỉ rows lệch" hoạt động đúng.
- [ ] Gọi `POST /admin/coupons/sync-from-at` → coupon mới có `isActive=false`. Approve 1 mã → public `/khuyen-mai/<merchant>` hiển thị.
- [ ] Gọi `POST /admin/top-products/sync` → snapshot today có ≥ 1 row. `GET /api/v1/top-products?limit=12` trả đủ. Homepage hiện section "Đang hot".
- [ ] `/admin/reconciliation`, `/admin/crawler-logs`, `/admin/campaigns` đều load không lỗi.

## Verify nothing's regressed

- [ ] `npm run test:api` → 7 suites pass (48+ tests).
- [ ] `npm run lint:web` clean.
- [ ] Public storefront `/`, `/categories/<slug>`, `/categories/<slug>/<product>` load bình thường.
- [ ] `/api/v1/categories` + `/api/v1/articles` không thay đổi shape.
