# STORY-01 — Schema migration: Campaign extension + Category↔Campaign relation

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 3h
**Dependencies:** Không có. **Đây là blocker cho tất cả story khác.**

## Context

Hiện tại `Campaign.externalId = slugify(offer.campaign)` ([import.service.ts:119](../../../../apps/api/src/modules/crawler/import.service.ts#L119)) — vì `/v1/datafeeds` không trả campaign_id thật. Hậu quả:
- Đổi tên campaign bên AT = tạo row mới (data fragmentation).
- Không link được với `/v1/campaigns` (trả `id` là số dài như `"5585194803623188142"`).
- `Category : Campaign = 1 : N` không có quan hệ explicit — chỉ join qua `Product`.

Story này thêm field/relation cần thiết cho toàn bộ refactor. Không thay logic gì — chỉ chuẩn bị đất.

**Quan trọng**: tất cả field mới phải `nullable` để data cũ không break. Migration phải reversible nếu cần rollback.

## User story

> **As** dev đang refactor sang AT-first,
> **I want** schema có chỗ chứa `atCampaignId` thật, `filterRules` per-campaign, và relation `Category → Campaign[]`,
> **so that** các story sau (sync, crawler refactor, onboard UI) có nơi đọc/ghi data.

## Acceptance criteria

### AC1 — Migration Prisma mới

File: `apps/api/prisma/migrations/<timestamp>_at_first_schema_extension/migration.sql`

Thêm vào model `Campaign`:

```prisma
model Campaign {
  // ... existing fields ...
  atCampaignId    String?   @unique          // ID thật từ AT /v1/campaigns (vd "5585194803623188142")
  atCategoryName  String?                    // category AT trả về (free text VN, vd "Sức khỏe - Làm đẹp")
  atSubCategory   String?                    // sub_category AT
  atLogo          String?                    // logo URL từ AT
  atMerchantUrl   String?                    // merchant homepage URL từ AT
  atScope         String?                    // "public" | "private" từ AT
  atCookieDurationSec Int?                   // cookie_duration từ AT (seconds)
  atStartTime     DateTime?                  // start_time từ AT campaign
  atEndTime       DateTime?                  // end_time từ AT campaign (nullable, có thể vô hạn)
  atRawData       Json?     @db.JsonB        // raw response từ AT — debug + future-proof
  atLastSyncedAt  DateTime?                  // lần cuối sync từ /v1/campaigns
  filterRules     Json?     @db.JsonB        // { minDiscountPercent, domains[], priceMin, priceMax, ... }
  categoryId      String?   @db.Uuid         // nullable: campaign chưa assign category
  category        Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([atCampaignId])
  @@index([categoryId])
}
```

Thêm vào model `Category`:

```prisma
model Category {
  // ... existing fields ...
  campaigns       Campaign[]                 // relation ngược (đã có Campaign.categoryId)
}
```

**Lưu ý**:
- `@@unique([network, externalId])` cũ giữ nguyên — không drop.
- `atCampaignId` UNIQUE (không kèm network) vì id của AT là global.
- Không thêm `NOT NULL` cho field mới — phải nullable để row cũ tồn tại.

### AC2 — Prisma client regenerate + types lan toả

- Chạy `npm run db:generate` từ root sau khi tạo migration.
- Verify `Prisma.Campaign` type có các field mới.
- KHÔNG sửa code logic ở story này — chỉ schema. Code sử dụng field mới sẽ được story 02-04 viết.

### AC3 — Zod schema cho `filterRules`

File mới: `apps/api/src/modules/crawler/dto/filter-rules.dto.ts`

```ts
import { z } from "zod";

export const filterRulesSchema = z.object({
  minDiscountPercent: z.number().int().min(0).max(100).optional(),
  maxDiscountPercent: z.number().int().min(0).max(100).optional(),
  domains: z.array(z.string()).optional(),         // whitelist, vd ["shopee.vn", "lazada.vn"]
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  status_discount: z.union([z.literal(0), z.literal(1)]).optional(),
  customFilters: z.record(z.string(), z.unknown()).optional()  // future-proof
}).strict();

export type FilterRules = z.infer<typeof filterRulesSchema>;

export const DEFAULT_FILTER_RULES: FilterRules = {
  minDiscountPercent: 0,
  status_discount: 1
};
```

Export từ `dto/index.ts` nếu có barrel; nếu không có thì import trực tiếp.

### AC4 — Backfill atCampaignId cho data cũ (best-effort)

Tạo seed update script: `apps/api/prisma/migrations/<timestamp>_at_first_schema_extension/backfill.sql` (chạy thủ công, không tự động).

```sql
-- Đánh dấu campaign cũ (externalId là slug, không phải id số) để admin biết cần re-sync
UPDATE "Campaign"
SET "notes" = COALESCE("notes", '') || E'\n[legacy] externalId=slug, cần backfill atCampaignId qua /admin/campaigns/sync-from-at'
WHERE "atCampaignId" IS NULL
  AND "externalId" !~ '^[0-9]+$';
```

Note: file này KHÔNG là Prisma migration tự động (Prisma sẽ skip nó vì không nằm trong `migration.sql`). Document trong [../MIGRATION-NOTES.md](../MIGRATION-NOTES.md) rằng admin cần chạy sau khi STORY-02 deploy.

### AC5 — Update doc

Cập nhật [docs/integrations/accesstrade.md](../../../integrations/accesstrade.md) mục 5 (Mapping):
- Đổi dòng "`campaign_id` (từ `/v1/campaigns`) | **Chưa có nơi lưu** ..." → "→ `Campaign.atCampaignId` (sau STORY-01)".

Cập nhật [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md) phần **Campaigns**:
- Đề cập field mới `atCampaignId`, `filterRules`, `categoryId`.
- Note: `externalId` (slug-based) giờ legacy, giữ để backward compat.

## Technical breakdown

### Files mới
- `apps/api/prisma/migrations/<timestamp>_at_first_schema_extension/migration.sql` (Prisma auto-generate khi chạy `npm run prisma:migrate --workspace api -- --name at_first_schema_extension`).
- `apps/api/src/modules/crawler/dto/filter-rules.dto.ts` (zod schema cho filterRules JSON).

### Files sửa
- `apps/api/prisma/schema.prisma` — thêm field + relation như AC1.
- `docs/integrations/accesstrade.md` — update mapping table.
- `apps/api/CLAUDE.md` — update section Campaigns.

### Files KHÔNG sửa ở story này
- `apps/api/src/modules/crawler/import.service.ts` — vẫn dùng `externalId = slugify(name)`. Story 03 sẽ refactor.
- `apps/api/src/modules/admin/admin.controller.ts` — không touch. Story 04 sẽ thêm endpoint sync.
- Bất kỳ admin UI nào — không touch.

### Sequence
1. Sửa `schema.prisma` theo AC1.
2. Chạy `npm run prisma:migrate --workspace api -- --name at_first_schema_extension` (interactive, sẽ prompt tạo migration).
3. Verify file SQL generated khớp expectation (chỉ `ALTER TABLE ... ADD COLUMN`, không drop gì).
4. Chạy `npm run db:generate` để regenerate client.
5. Tạo `filter-rules.dto.ts` theo AC3.
6. Update doc (AC5).
7. Commit.

## Definition of Done

- [ ] `apps/api/prisma/schema.prisma` có đầy đủ field như AC1.
- [ ] Migration file generated, SQL chỉ chứa `ALTER TABLE ADD COLUMN` (không drop).
- [ ] `npm run db:generate` chạy clean, không lỗi.
- [ ] `apps/api/src/modules/crawler/dto/filter-rules.dto.ts` exist + export `filterRulesSchema`, `FilterRules`, `DEFAULT_FILTER_RULES`.
- [ ] `npm run build` pass cho cả `api` và `web` (không có usage mới nên không break).
- [ ] `npm run test:api` pass.
- [ ] `npx prisma migrate status --schema apps/api/prisma/schema.prisma` báo migration đã apply.
- [ ] Verify trong pgAdmin (`localhost:5050`) thấy columns mới trong table `Campaign`.
- [ ] Doc updated.

## Out of scope

- **Logic sử dụng field mới**: story 02 (sync) sẽ ghi `atCampaignId`, `atRawData`, ...; story 03 (crawler refactor) sẽ đọc `filterRules`; story 04 (UI) sẽ set `categoryId`.
- **Backfill data cũ tự động**: chỉ note vào MIGRATION-NOTES.md, không chạy auto.
- **Drop `Campaign.externalId`**: giữ field cũ làm backward compat. STORY-08 (cleanup) sẽ cân nhắc drop sau khi tất cả campaign cũ đã backfill.
- **Sửa zod schema cho admin endpoint**: chưa có endpoint nào nhận `filterRules` ở story này; story 04 sẽ thêm.

## Notes cho AI agent

- **Đừng tạo migration thủ công** bằng cách viết SQL trực tiếp vào file `.sql`. Luôn dùng `npm run prisma:migrate --workspace api -- --name <name>` để Prisma tự gen — đảm bảo schema state khớp client.
- **Kiểm tra migration SQL** trước khi commit: mở file generated, đảm bảo không có `DROP COLUMN` hay `DROP TABLE` nào (Prisma đôi khi gen surprise nếu schema drift).
- **Type `Json` field**: dùng `Prisma.InputJsonValue` khi write, đọc bằng cast through zod (xem [admin.controller.ts](../../../../apps/api/src/modules/admin/admin.controller.ts) pattern).
- **`@db.Uuid` cho FK**: bắt buộc với postgres, không quên.
- **Relation cycle**: Campaign.category ↔ Category.campaigns đã có Campaign.products ↔ Category.products từ Product.categoryId. Cẩn thận không tạo Loop trong query (vd `category.campaigns.products` infinite expand).
