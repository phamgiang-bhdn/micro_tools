# STORY-10 — Onboard ops: pull 50 real products + 3 articles

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P0
**Estimate:** 4h operator work (KHÔNG phải dev) + 30 phút support dev nếu pipeline có issue.
**Dependencies:** Không có (backend pipeline đã sẵn từ sprint at-source-of-truth). Chạy song song với STORY-01 ngày 1.

## Context

Sau STORY-02/03 merge, frontend đã đẹp đủ để release — nhưng nếu DB rỗng thì site empty = 0 conversion.

Audit 2026-05-23 DB state:
- 100 niches ✓
- 0 products ✗
- 0 articles published ✗
- 4 campaigns synced sau khi chạy admin button (oneat_referral, lazada_kol, nguyenkimvn, tiktok_cps) — 3 actionable (skip oneat referral self-promo).

Story này **không phải dev work** — là **operator playbook** để owner/operator pull data thật, review, publish — chạy song song với dev stories.

## User story

> **As** owner dealvault chạy launch,
> **I want** ≥50 product publish + ≥3 article publish trong 3 priority niche (laptop, tai-nghe-tws, robot-hut-bui-lau-nha) trước khi public site,
> **so that** ngày launch user landing không thấy site trống.

## Acceptance criteria (operator checklist)

### AC1 — Assign 3 priority niches cho 3 campaign

**Admin URL**: http://localhost:3100/admin/campaigns

3 priority niche cho launch (mapping merchant nào pull cho niche nào):

| Niche slug | Campaign assignments | Lý do |
|---|---|---|
| `laptop` | `lazada_kol`, `tiktok_cps` | Lazada + TikTok có nhiều SKU laptop, mới-cũ phong phú |
| `tai-nghe-tws` | `lazada_kol`, `tiktok_cps`, `nguyenkimvn` | Tai nghe TWS giá rẻ trên TikTok, mid-range NK + Lazada |
| `robot-hut-bui-lau-nha` | `lazada_kol`, `nguyenkimvn` | Roborock/Dreame chủ yếu Lazada + Nguyễn Kim |

**Filter rules per assignment** (ko cần optimal lần đầu — adjust sau):

```json
{
  "minDiscountPercent": 15,
  "priceMin": 500000,
  "priceMax": null,
  "domains": []
}
```

- `minDiscountPercent: 15`: tránh deal lẻ giảm 5% không đáng.
- `priceMin: 500000`: tránh phụ kiện rẻ tiền.
- `priceMax`: null → không giới hạn trên.
- `domains: []`: không filter domain (chấp nhận mọi merchant trong campaign).

Steps:
1. Vào `/admin/campaigns` → mỗi campaign → button "Gán Niche".
2. Multi-select 1-3 niche theo bảng trên.
3. Mỗi assignment có form filterRules → set values trên.
4. Save.

### AC2 — Trigger crawler manual

**Admin URL**: http://localhost:3100/admin (dashboard) → button "Chạy crawler thủ công".

Hoặc curl:
```bash
curl -X POST http://localhost:4000/api/v1/admin/crawler/run \
  -H "x-admin-role: admin" \
  -H "x-admin-key: $ADMIN_API_KEY"
```

Expected response:
```json
{
  "ok": true,
  "totalFetched": ~300,
  "totalImported": ~150,
  "assignments": [
    { "campaignName": "...", "nicheSlug": "...", "fetched": 100, "imported": 50, "skipped": 50 }
  ]
}
```

Crawler run ~30-60 giây cho 5 assignments × 100 product/page.

**Verify**:
```sql
SELECT n.slug, COUNT(p.id) FROM "Niche" n LEFT JOIN "Product" p ON p."nicheId" = n.id
WHERE n.slug IN ('laptop','tai-nghe-tws','robot-hut-bui-lau-nha') GROUP BY n.slug;
```

Expect: mỗi niche có ≥30 product, total ≥100.

### AC3 — Review + approve via Refinery

**Admin URL**: http://localhost:3100/admin/refinery

Mục tiêu: approve **≥50 product total** (~17 product per niche) — không phải approve hết, chỉ pick quality.

**Quality criteria khi review**:
- ✓ Có image rõ (không placeholder).
- ✓ Title không spam ký tự (no "★★★ FREESHIP 99K ★★★" — chỉ title sản phẩm).
- ✓ Giá hợp lý (không 999 VND scam).
- ✓ Discount thực (so sánh originalPrice với giá thị trường — google nhanh nếu nghi ngờ).
- ✓ Store badge merchant uy tín.

Action per row:
- **Approve**: button approve → `ProductExtraction.status = PUBLISHED` + `Product.isPublic = true` → visible storefront.
- **Reject**: button reject → ẩn khỏi storefront.
- **Retry extract**: nếu AI extraction lỗi/thiếu field, click retry — re-run với schema.

Keyboard shortcut Refinery (đã có): `j`/`k` di chuyển, `a` approve, `r` reject.

**Time estimate**: 50 product × 30 giây/row = ~25 phút.

### AC4 — Generate 3 article

**Admin URL**: http://localhost:3100/admin/articles/new

3 article cho launch:

| # | Niche | Type | Topic |
|---|---|---|---|
| 1 | `laptop` | `BUYING_GUIDE` | "Top laptop sinh viên dưới 15 triệu tốt nhất tháng 5/2026" |
| 2 | `tai-nghe-tws` | `REVIEW` | "Review Sony WF-1000XM5 sau 30 ngày dùng: đáng mua trong tầm giá?" |
| 3 | `robot-hut-bui-lau-nha` | `BUYING_GUIDE` | "Chọn robot hút bụi cho nhà có thú cưng: 5 model đáng cân nhắc 2026" |

Process per article (~30 phút mỗi bài, includes review + edit):

1. Click "Tạo bài viết mới".
2. Chọn niche + type + nhập topic.
3. Pick "Sản phẩm liên quan" (productIds) — 3-5 product đã approve trong niche, dùng làm productHints cho AI.
4. Click "Tạo bài". AI pipeline chạy ~3-5 phút (brief → research → outline → writer → critic).
5. Pipeline xong → article ở status `PENDING_REVIEW`. Vào `/admin/articles/<id>` review.
6. Edit từng section nếu cần — pay attention to:
   - **Title**: AI đôi khi thêm "tốt nhất 2026" repeat — rút gọn.
   - **Excerpt**: phải hook trong 2 câu.
   - **Section heading**: phải actionable, không generic.
   - **FAQ**: verify 5-7 câu hỏi thực user search.
   - **Pros/cons**: phải cụ thể, không "ưu điểm: tốt".
7. Khi OK, click "Publish".

### AC5 — Verify launch state

Sau khi xong, verify:

```sql
-- 1. Product count
SELECT COUNT(*) FROM "Product" WHERE "isPublic" = true;
-- expect: >= 50

-- 2. Per priority niche
SELECT n.slug, COUNT(p.id) FROM "Niche" n
  JOIN "Product" p ON p."nicheId" = n.id
  WHERE p."isPublic" = true AND n.slug IN ('laptop','tai-nghe-tws','robot-hut-bui-lau-nha')
  GROUP BY n.slug;
-- expect: mỗi niche >= 15

-- 3. Article publish
SELECT slug, title, status, type FROM "Article" WHERE status = 'PUBLISHED';
-- expect: 3 rows

-- 4. Top discount sample
SELECT name, "scrapedData"->>'price', "scrapedData"->>'originalPrice'
  FROM "Product"
  WHERE "isPublic" = true
  ORDER BY (("scrapedData"->>'discountPercent')::int) DESC
  LIMIT 10;
-- expect: top 10 có discountPercent >= 20%
```

### AC6 — Coupon onboard (optional)

Trigger coupon sync:

```bash
curl -X POST http://localhost:4000/api/v1/admin/coupons/sync-from-at \
  -H "x-admin-role: admin" \
  -H "x-admin-key: $ADMIN_API_KEY"
```

Sau sync, vào `/admin/coupons` approve những coupon từ Lazada + Shopee + TikTok còn hạn dùng.

Time estimate: 10-15 phút approve 20 coupon đầu.

### AC7 — TopProducts snapshot

Trigger snapshot:

```bash
curl -X POST http://localhost:4000/api/v1/admin/top-products/sync \
  -H "x-admin-role: admin" \
  -H "x-admin-key: $ADMIN_API_KEY"
```

Verify homepage section "🔥 Đang hot tuần này" có data.

### AC8 — Final visual check

Open http://localhost:3100 trong browser. Checklist:

- [ ] Homepage above-fold có hot deal grid (≥4 card visible).
- [ ] Click "Laptop" niche → niche page có ≥15 product.
- [ ] Click 1 product → detail page render với JSON-LD.
- [ ] Click "Mua ngay" → POST tracking → redirect affiliate URL với utm_source.
- [ ] `/blog` có 3 article.
- [ ] Click 1 article → render với hero + sections + ProductCardEnd + StickyProductCta.
- [ ] `/khuyen-mai/lazada` có ≥3 coupon.

## Files touched

**KHÔNG có code changes.** Story này chỉ là operator playbook.

Output artifacts (cho launch readiness):
- Screenshot homepage populated → `docs/sprints/vn-storefront-v2/screenshots/post-onboarding-home.png`
- Screenshot niche page → `post-onboarding-laptop.png`
- Screenshot article → `post-onboarding-article.png`

## Verification

Verify AC5 SQL queries pass.

Verify visual checklist AC8.

## Definition of done

- [ ] ≥50 product `isPublic = true` total.
- [ ] ≥15 product per priority niche (laptop, tai-nghe-tws, robot-hut-bui).
- [ ] 3 article published, mỗi article có productIds[] reference real products.
- [ ] ≥10 coupon approved + active.
- [ ] TopProductSnapshot có row cho ngày hiện tại.
- [ ] Homepage screenshot có data hiển thị.

## Notes for next session

- Story này có thể chạy lặp lại weekly để top up content fresh.
- Operator có thể script hóa bước approve bằng SQL bulk update nếu trust crawler output (KHÔNG khuyến nghị — HITL gate exist for a reason).
- Nếu crawler return < 100 product/run, debug bằng:
  - Check `Campaign.filterRules.minDiscountPercent` — nếu set quá cao (e.g. 30%) → ít offer match.
  - Check Accesstrade dashboard manually xem campaign có còn offer active không.
  - Check `apps/api/src/modules/crawler/clients/accesstrade.client.ts` log.
- Article generation có thể fail ở stage `research` nếu Tavily API key invalid hoặc rate-limited. Fallback: manual edit + skip research stage.
- Nếu Gemini/AI provider rate-limit, ngừng 5 phút rồi thử lại.
- Mỗi article cần 30-45 phút operator work (review + edit) — KHÔNG nên rush. Quality article > many article.
