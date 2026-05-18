# Cleanup queue — defer past at-source-of-truth sprint

Các field / file / env dưới đây đã có replacement, nhưng KHÔNG drop trong sprint at-source-of-truth vì còn risk (data legacy, fallback path, multi-network skeleton). Khi trigger condition đạt, drop trong PR riêng + migration riêng.

## `Campaign.externalId`

- **Replacement**: `Campaign.atCampaignId` (unique, real Accesstrade id).
- **Marked**: `@deprecated` JSDoc trên field trong `apps/api/prisma/schema.prisma`.
- **Trigger drop**:
  - `SELECT COUNT(*) FROM "Campaign" WHERE "atCampaignId" IS NULL` = 0.
  - `Campaign_network_externalId_key` không còn caller (grep `network_externalId`).
- **Drop steps**:
  1. Migration: drop `@@unique([network, externalId])`, drop column `externalId`.
  2. Code: xoá `ImportService.resolveCampaignId` (web-scrape path mất Campaign auto-create — admin phải pre-create).
  3. Xoá field từ admin DTO (`createCampaignSchema.externalId`).

## `ImportService.resolveCampaignId`

- **Replacement**: `offer.campaignDbId` pre-resolved bởi `CrawlerService.runFullCycle` (per-campaign loop).
- **Marked**: `@deprecated` JSDoc.
- **Trigger drop**: khi `WebScrapeClient` không còn dùng (admin luôn dùng UI assign campaign).
- **Risk nếu drop sớm**: paste-URL flow (admin paste URL Shopee/Lazada tay) sẽ fail vì Product không link Campaign.

## `category-inference.util.ts` + `DEFAULT_CATEGORY_SLUG = "tech-gadgets"`

- **Replacement**: `Campaign.categoryId` (admin assign tay trong `/admin/campaigns`).
- **Marked**: `@deprecated` JSDoc.
- **Trigger drop**: khi `WebScrapeClient` không còn dùng.
- **Keyword table chưa update theo niche v1** (`robot-hut-bui-lau-nha`, `may-loc-khong-khi`) — vì path inference này ngoài scope crawler-cycle. Đừng cố sync keyword table cho v1.

## `CRAWLER_ENABLED_NETWORKS` env + Shopee/Lazada/TikTok client stubs

- **Replacement**: hard-code Accesstrade nếu chắc chắn không direct integrate.
- **Trigger drop**: 6 tháng sau launch v1 mà không onboard Shopee Open API / Lazada API / TikTok Shop direct.
- **Drop steps**:
  1. Xoá `shopee.client.ts`, `lazada.client.ts`, `tiktok.client.ts`.
  2. Xoá `CRAWLER_ENABLED_NETWORKS` từ `.env.example` + `CrawlerService`.
  3. Có thể giữ enum `AffiliateNetwork` để link với data lịch sử (`Product.network = "SHOPEE"` từ paste URL).

## `Coupon.code` UNIQUE constraint

- **Replacement**: `Coupon.atCouponId` UNIQUE (đã có, dùng cho dedup AT sync).
- **Trigger drop**: khi confirm admin không còn tạo coupon tay với mã thật (vd `SHOPEE10K`) ngoài AT sync flow.
- **Risk**: phá flow admin tự nhập coupon code → admin UI cũ vẫn dùng `code` field. Drop sau khi admin form refactor sang `atCouponId`.

## `Product.campaignId` nullable

- KHÔNG drop. Product cũ (trước STORY-01) có `campaignId = null`. Storefront vẫn render được; admin filter "không gắn campaign" hữu ích.

---

**Quy tắc chung**: trước khi drop field, xoá mọi caller code TRƯỚC, deploy → đợi ≥ 1 tuần không lỗi → mới drop migration. Drop migration phải irreversible — đừng vội.
