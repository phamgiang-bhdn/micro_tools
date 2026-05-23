# STORY-01 — AT-only cleanup: xoá multi-network code thừa

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 3h
**Dependencies:** Không có. **Blocker cho STORY-02/03** vì admin re-org sẽ ẩn menu "Phân loại AT", cần biết Network=ACCESSTRADE là duy nhất.

## Context

Codebase được thiết kế multi-network từ đầu (Accesstrade + Shopee/Lazada/TikTok direct). Owner chỉ dùng AT, nhưng:

- 3 stub client (`shopee.client.ts`, `lazada.client.ts`, `tiktok.client.ts`) trả `not_implemented` — bloat module + confuse gà mờ "tôi có thể enable Shopee ko?".
- `web-scrape.client.ts` Playwright + Gemini cho URL bất kỳ — power-tool dev, gà mờ ko dùng, vẫn được register trong `CrawlerModule`.
- `Product.network` field luôn `"ACCESSTRADE"` — show trong nhiều UI filter, vô nghĩa.
- 3 webhook route `/webhooks/shopee|lazada|tiktok` trả `{success: false, reason: "not_implemented"}` — tăng surface attack + confuse log.
- `CRAWLER_ENABLED_NETWORKS` env gate luôn `"accesstrade"` — flag vô dụng.
- `niche-inference.util.ts` đã `@deprecated` từ sprint at-source-of-truth nhưng chưa xoá.

Cleanup không thay đổi business logic — chỉ thu hẹp surface area.

## User story

> **As** gà mờ operator chỉ ký hợp tác với Accesstrade,
> **I want** admin UI và backend code không show option Shopee/Lazada/TikTok direct nữa,
> **so that** tôi không bị confuse "có phải bật cái này để Shopee chạy không?".

## Acceptance criteria

### AC1 — Xoá 3 stub network client

Xoá hoàn toàn:
- `apps/api/src/modules/crawler/clients/shopee.client.ts`
- `apps/api/src/modules/crawler/clients/lazada.client.ts`
- `apps/api/src/modules/crawler/clients/tiktok.client.ts`

Update `apps/api/src/modules/crawler/crawler.module.ts`:
- Remove 3 client từ `providers` array.
- Remove import statements.

Update `apps/api/src/modules/crawler/crawler.service.ts`:
- Remove 3 client từ constructor injection.
- Remove khỏi `all` array (the array of AffiliateClient injected).
- Verify `runFullCycle` chỉ inject `AccesstradeClient`.

Update `apps/api/src/modules/crawler/clients/affiliate-client.interface.ts`:
- Giữ interface (vẫn dùng cho `AccesstradeClient`).
- Nếu interface không export ra ngoài module, có thể inline luôn vào `accesstrade.client.ts`.

### AC2 — Web-scrape client — move sang advanced (không xoá)

`apps/api/src/modules/crawler/clients/web-scrape.client.ts` giữ lại nhưng:
- Remove khỏi `crawler.service.ts` runFullCycle (không chạy trong cycle chính).
- Vẫn register trong `CrawlerModule` providers (để admin endpoint paste-URL có thể inject).
- Document trong `apps/api/CLAUDE.md` rằng đây là **advanced tool**, chỉ dùng cho admin endpoint `POST /admin/products/import-url` (nếu có).
- Admin UI: nếu trang "Import URL → AI ingest" tồn tại trên dashboard chính (xem screenshot 2026-05-23 admin dashboard), **move xuống menu "Hệ thống nâng cao"** (sẽ implement trong STORY-03).

### AC3 — Xoá `Product.network` UI display

Schema giữ field `Product.network` (data đã có, breaking change nếu drop).

Update UI để KHÔNG show:
- `apps/web/app/admin/products/page.tsx` (list products) — bỏ column "Network" nếu có.
- `apps/web/app/admin/products/[id]/page.tsx` (detail) — bỏ field display.
- `apps/web/app/admin/campaigns/*` — bỏ display nếu có.
- Public storefront — verify không show "ACCESSTRADE" anywhere (đã check trong screenshot 2026-05-23 không có).

Grep guardrail:
```bash
grep -rn "network\|Network" apps/web/app apps/web/components | grep -v "node_modules\|.d.ts\|api/v1/" | grep -iE "(label|title|column|placeholder|>"
```

### AC4 — Đơn giản hoá webhook routes

Hiện tại có 4 webhook route (theo doc):
- `/api/v1/webhooks/conversion` hoặc `/webhooks/accesstrade` — AT (active)
- `/api/v1/webhooks/shopee` — stub
- `/api/v1/webhooks/lazada` — stub
- `/api/v1/webhooks/tiktok` — stub

File: `apps/api/src/modules/webhooks/webhooks.controller.ts`

Refactor:
- Giữ chỉ 1 endpoint `@Post("conversion")` (hoặc `@Post("accesstrade")` tuỳ tên current). Đặt route name rõ ràng — gợi ý `@Post("accesstrade")` vì sau có thể add network khác.
- Xoá 3 handler stub Shopee/Lazada/TikTok.
- Document trong controller file header comment: "Hiện chỉ accept Accesstrade webhook. Khi onboard network khác, thêm `@Post('<network-slug>')` mới với logic parse riêng (không generic polymorphic)."

### AC5 — Xoá `CRAWLER_ENABLED_NETWORKS` env

File: `apps/api/src/modules/crawler/crawler.service.ts` — tìm chỗ đọc `process.env.CRAWLER_ENABLED_NETWORKS`.

Replace:
```ts
const enabledNetworks = (process.env.CRAWLER_ENABLED_NETWORKS ?? "accesstrade")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const clients = this.all.filter(c => enabledNetworks.includes(c.network));
```

Thành:
```ts
// AT-only operation. Multi-network support đã removed STORY-01 (at-money-flows-v1).
const clients = this.all; // chỉ còn AccesstradeClient
```

Remove `CRAWLER_ENABLED_NETWORKS` khỏi:
- `apps/api/.env.example`
- `apps/api/CLAUDE.md` (đoạn document env)
- Bất cứ doc nào mention.

### AC6 — Xoá `niche-inference.util.ts`

File: `apps/api/src/modules/crawler/niche-inference.util.ts`

Tìm caller cuối cùng:
```bash
grep -rn "niche-inference\|inferNicheSlug\|inferCategorySlug" apps/api/src
```

Doc nói chỉ còn `web-scrape.client.ts` gọi fallback. Verify:
- Nếu web-scrape không gọi → xoá file hoàn toàn.
- Nếu còn gọi → inline logic vào web-scrape (nó là power-tool, có thể chấp nhận hardcode keyword) hoặc delete và để web-scrape require `nicheSlug` từ caller.

Pick: delete file, web-scrape require explicit `nicheSlug` param (operator phải chọn khi paste URL).

### AC7 — Update CLAUDE.md docs

Files:
- `apps/api/CLAUDE.md` — section "Crawler": remove paragraph about multi-network, simplify "Active networks env-gated"
- `docs/CONTEXT.md` — section nếu mention multi-network strategy → cập nhật "AT-only operation"
- `docs/integrations/accesstrade.md` — section 5 "Mapping": no change needed

Add 1 paragraph trong `apps/api/CLAUDE.md` Crawler section:

```markdown
## AT-only operation (since sprint at-money-flows-v1)

Codebase ban đầu thiết kế multi-network. Sau STORY-01 cleanup, chỉ còn `AccesstradeClient` active. Khi onboard network khác (Shopee/Lazada direct):
1. Implement `AffiliateClient` interface mới (xem [`affiliate-client.interface.ts`]).
2. Register trong `CrawlerModule.providers`.
3. Inject vào `CrawlerService.all[]`.
4. Add webhook endpoint riêng `@Post("<network>")` trong `webhooks.controller.ts` (KHÔNG generic polymorphic).

Backbone code đã sẵn sàng, chỉ chưa có client thật.
```

### AC8 — Grep guardrail script

NEW file: `apps/api/scripts/check-at-only.mjs`:

```js
import { execSync } from "node:child_process";

const FORBIDDEN_IN_CODE = [
  "shopee.client", "lazada.client", "tiktok.client",
  "shopee-cps-direct", "lazada-direct", "tiktok-direct",
  "CRAWLER_ENABLED_NETWORKS",
  "inferNicheSlug", "inferCategorySlug", "niche-inference"
];

let failed = 0;
for (const pattern of FORBIDDEN_IN_CODE) {
  try {
    const result = execSync(`grep -rn "${pattern}" src --exclude-dir=node_modules 2>&1 || true`, { encoding: "utf8" });
    if (result.trim().length > 0) {
      console.error(`[at-only check] Found "${pattern}":\n${result}`);
      failed++;
    }
  } catch (e) { /* grep exits 1 when no match — OK */ }
}
process.exit(failed > 0 ? 1 : 0);
```

Add script `apps/api/package.json`:
```json
"check:at-only": "node scripts/check-at-only.mjs"
```

Run trong CI hoặc pre-commit (optional).

## Files touched

```
apps/api/src/modules/crawler/clients/shopee.client.ts          (DELETE)
apps/api/src/modules/crawler/clients/lazada.client.ts          (DELETE)
apps/api/src/modules/crawler/clients/tiktok.client.ts          (DELETE)
apps/api/src/modules/crawler/clients/web-scrape.client.ts      (keep, comment "advanced only")
apps/api/src/modules/crawler/niche-inference.util.ts           (DELETE)
apps/api/src/modules/crawler/crawler.module.ts                  (remove 3 stub providers)
apps/api/src/modules/crawler/crawler.service.ts                 (remove network-gated logic, AT-only)
apps/api/src/modules/webhooks/webhooks.controller.ts            (remove 3 stub handlers)
apps/api/.env.example                                            (remove CRAWLER_ENABLED_NETWORKS)
apps/api/CLAUDE.md                                               (update Crawler section)
apps/api/scripts/check-at-only.mjs                               (NEW guardrail)
apps/api/package.json                                            (add check:at-only script)
apps/web/app/admin/products/page.tsx                             (remove network display if any)
apps/web/app/admin/products/[id]/page.tsx                        (remove network display if any)
docs/CONTEXT.md                                                  (update if mentions multi-network)
```

## Verification

```bash
# 1. Guardrail script
npm run check:at-only --workspace api
# expect: exit 0

# 2. API typecheck + build
cd apps/api && npx tsc --noEmit
# expect: 0 errors

# 3. Crawler run still works
curl -X POST http://localhost:4000/api/v1/admin/crawler/run \
  -H "x-admin-role: admin" -H "x-admin-key: $ADMIN_API_KEY"
# expect: {ok: true, totalFetched: N, ...}

# 4. Webhook AT still accept
curl -X POST http://localhost:4000/api/v1/webhooks/accesstrade \
  -H "Content-Type: application/json" \
  -d '{"trackingCode":"test","revenue":1000,"status":"approved","payload":{}}'
# expect: 200 or 201

# 5. Webhook stub endpoints gone
curl -i http://localhost:4000/api/v1/webhooks/shopee -X POST
# expect: 404

# 6. No Shopee/Lazada/TikTok in admin UI
node apps/web/scripts/check-public-copy.mjs # nếu storefront-v2 STORY-09 đã merge guardrail
# OR grep manually:
grep -rn "Shopee\|Lazada\|TikTok" apps/web/app/admin | grep -iE "(label|option|filter|column)"
# expect: 0 or chỉ những chỗ là store badge cho user-facing (giữ vì user thấy Shopee là merchant)
```

## Definition of done

- [ ] 3 stub client file (`shopee/lazada/tiktok`) đã DELETE.
- [ ] `web-scrape.client.ts` không inject vào `runFullCycle`, vẫn available cho admin paste-URL.
- [ ] `niche-inference.util.ts` DELETE.
- [ ] `CRAWLER_ENABLED_NETWORKS` env không còn trong code + .env.example.
- [ ] Webhook chỉ còn 1 endpoint AT (3 stub endpoint xoá).
- [ ] `Product.network` field còn schema nhưng KHÔNG display admin UI.
- [ ] `check:at-only` script pass.
- [ ] CLAUDE.md doc updated với section "AT-only operation".
- [ ] Crawler manual run vẫn work, webhook AT vẫn accept.

## Notes for next session

- Schema field `Product.network` GIỮ NGUYÊN. Drop column = breaking migration, ko đáng. Chỉ ẩn UI là đủ.
- Webhook endpoint rename `conversion → accesstrade` chỉ làm nếu hiện đang tên `conversion`. Nếu đã tên `accesstrade` thì giữ.
- Nếu sau onboard network mới: thêm client + webhook handler + update guardrail script `check-at-only.mjs` (rename → `check-allowed-networks.mjs`).
- Web-scrape advanced tool: STORY-03 sẽ move UI button vào menu "Hệ thống nâng cao" collapse. Story này chỉ chuẩn bị backend.
