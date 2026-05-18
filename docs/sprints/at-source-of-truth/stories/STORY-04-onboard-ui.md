# STORY-04 — Admin UI: onboard campaign → assign category + edit filter rules

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 6h
**Dependencies:** [STORY-02](STORY-02-campaign-sync.md) (UI list cần dữ liệu sync về), [STORY-03](STORY-03-per-campaign-crawler.md) (filterRules được dùng bởi crawler).

## Context

Sau STORY-02, table `Campaign` đầy dữ liệu thật từ AT — nhưng admin chưa có UI để:
1. Xem trực quan campaign nào đã assign category, campaign nào chưa.
2. Assign campaign vào category (chọn category cũ hoặc tạo mới ngay).
3. Edit `filterRules` per campaign (form đơn giản, không phải JSON raw).
4. Xem metadata AT trả về (logo, description HTML, scope, cookie duration).

Đây là nơi admin **define nghiệp vụ business mới**: từ "tạo Category trước" → "chọn campaign từ AT, mới gom thành Category public".

**Reference UI convention**: [project_admin_ui_conventions.md] memory — `ListPageShell + FormDialog + RowActions + constants.ts`; magic string lấy từ `lib/admin/constants.ts`; không có `/new` routes (dùng dialog).

## User story

> **As** admin DealVault,
> **I want** quản lý mapping Campaign → Category trong /admin/campaigns với UI thân thiện (logo, status badge, filter rules form),
> **so that** tôi onboard niche mới = 2 click thay vì sửa code.

## Acceptance criteria

### AC1 — Hiển thị logo + metadata AT trong table

File: [apps/web/app/admin/campaigns/campaigns-table.tsx](../../../../apps/web/app/admin/campaigns/campaigns-table.tsx)

Thêm cột:
- **Logo** (32x32, `atLogo` URL, fallback placeholder).
- **AT Category** (`atCategoryName`, badge xám).
- **Assigned Category** (`Category.name + slug`, nullable → badge "Chưa assign" màu vàng).
- **Filter Rules summary** (vd "≥20%, shopee.vn" — render từ `filterRules` JSON; nếu null → "Default").
- **Last synced** (relative time `atLastSyncedAt`, vd "5 phút trước").

Giữ các cột cũ (name, merchant, status, ...).

Convention component: dùng helper `StatusPill` từ [apps/web/components/admin/ui/status-pill.tsx](../../../../apps/web/components/admin/ui/status-pill.tsx) cho status badge.

### AC2 — Dialog "Assign to Category"

File mới: `apps/web/app/admin/campaigns/assign-category-dialog.tsx`

Convention: dùng `FormDialog` component từ [apps/web/components/admin/ui/](../../../../apps/web/components/admin/ui/index.ts).

Props:
```ts
interface Props {
  campaign: {
    id: string;
    name: string;
    atLogo: string | null;
    atCategoryName: string | null;
    merchantName: string | null;
    categoryId: string | null;
    filterRules: unknown;       // Json from API
  };
  categories: Array<{ id: string; name: string; slug: string }>;
  onSubmit: (data: AssignCategoryInput) => Promise<void>;
  onClose: () => void;
}
```

Form fields:
- **Category** — Select 2-mode:
  - Mode "Existing": dropdown chọn category đã có.
  - Mode "Create new": inline form (name, slug auto-generated kebab-case, schemaConfig template default).
  - Toggle "Tạo category mới" radio button trên dropdown.
- **Filter rules** — fieldset "Filter rules":
  - `minDiscountPercent` (number, 0-100, default 0).
  - `maxDiscountPercent` (number, 0-100, optional).
  - `domains` (multi-tag input, vd thêm "shopee.vn"; chip có nút xoá).
  - `priceMin` / `priceMax` (number, optional).
  - `status_discount` (select: "Mọi sản phẩm" = không set | "Chỉ sản phẩm có discount" = 1).
- **Preview** — hiển thị tổng số sản phẩm match (gọi endpoint `/admin/campaigns/:id/preview-filter` lazy load — optional, nice-to-have).

Validate client-side bằng react-hook-form + zodResolver. Schema: **`assignCategoryFormSchema`** trong `apps/web/app/admin/campaigns/assign-category-dialog.tsx`:

```ts
import { z } from "zod";
import { filterRulesSchema } from "@/lib/admin/filter-rules.schema";  // mirror server zod (xem AC dưới)

const SLUG_RE = /^[a-z0-9-]+$/;

const schemaConfigValueSchema = z.enum(["string", "number", "boolean", "string[]"]);

const newCategorySchema = z.object({
  name: z.string().min(1, "Tên category bắt buộc").max(120),
  slug: z.string().min(1).max(80).regex(SLUG_RE, "Slug chỉ chứa a-z, 0-9, dấu gạch"),
  schemaConfig: z.record(z.string().min(1), schemaConfigValueSchema)
    .refine((r) => Object.keys(r).length > 0, { message: "schemaConfig cần ít nhất 1 field" })
});

export const assignCategoryFormSchema = z.object({
  mode: z.enum(["existing", "new"]),
  categoryId: z.string().uuid().optional(),
  newCategory: newCategorySchema.optional(),
  filterRules: filterRulesSchema
}).superRefine((data, ctx) => {
  if (data.mode === "existing" && !data.categoryId) {
    ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Chọn category" });
  }
  if (data.mode === "new" && !data.newCategory) {
    ctx.addIssue({ code: "custom", path: ["newCategory"], message: "Điền thông tin category mới" });
  }
});

export type AssignCategoryFormValues = z.infer<typeof assignCategoryFormSchema>;
```

**Lưu ý chuẩn `mt-dev` section 3.2 (Form)**: schema sống cùng folder với form, named `<entity>Schema`. `filterRulesSchema` import từ `@/lib/admin/filter-rules.schema.ts` (mirror tối thiểu của zod server-side ở STORY-01) — không tự định nghĩa lại nguyên block.

Display zod error: dùng `formState.errors` → render dưới field. Submit blocked nếu schema fail; backend zod là phòng tuyến 2.

### AC3 — Server action `assignCategoryToCampaign`

File: [apps/web/app/admin/actions.ts](../../../../apps/web/app/admin/actions.ts) (hoặc file actions cho campaigns)

```ts
"use server";

import { revalidatePath } from "next/cache";

interface AssignCategoryInput {
  campaignId: string;
  categoryId?: string;                  // tồn tại → assign
  newCategory?: {                       // không có categoryId → tạo mới
    name: string;
    slug: string;
    schemaConfig: Record<string, unknown>;
  };
  filterRules: {
    minDiscountPercent?: number;
    maxDiscountPercent?: number;
    domains?: string[];
    priceMin?: number;
    priceMax?: number;
    status_discount?: 0 | 1;
  };
}

export async function assignCategoryToCampaign(input: AssignCategoryInput) {
  const res = await fetch(`${process.env.API_BASE}/admin/campaigns/${input.campaignId}/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-role": "admin",
      "x-admin-key": process.env.ADMIN_API_KEY ?? ""
    },
    body: JSON.stringify({
      categoryId: input.categoryId,
      newCategory: input.newCategory,
      filterRules: input.filterRules
    }),
    cache: "no-store"
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Assign failed: ${error}`);
  }
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/categories");
  return res.json();
}
```

### AC4 — Backend endpoint `POST /admin/campaigns/:id/assign`

File: [apps/api/src/modules/admin/admin.controller.ts](../../../../apps/api/src/modules/admin/admin.controller.ts)

Zod schema:
```ts
import { filterRulesSchema } from "../crawler/dto/filter-rules.dto";

const assignCategorySchema = z.object({
  categoryId: z.string().uuid().optional(),
  newCategory: z.object({
    name: z.string().min(1).max(120),
    slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
    schemaConfig: z.record(z.string(), z.unknown())
  }).optional(),
  filterRules: filterRulesSchema
}).refine(
  (data) => Boolean(data.categoryId) !== Boolean(data.newCategory),
  { message: "Phải có đúng 1 trong: categoryId hoặc newCategory" }
);
```

Handler:
```ts
@Post("campaigns/:id/assign")
async assignCampaign(
  @Param("id") id: string,
  @Body() payload: unknown,
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["admin"]);
  const parsed = assignCategorySchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
  }

  const campaign = await this.prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new HttpException("Campaign not found", HttpStatus.NOT_FOUND);

  let categoryId = parsed.data.categoryId;
  if (parsed.data.newCategory) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: parsed.data.newCategory.slug }
    });
    if (existing) {
      throw new HttpException("Slug đã tồn tại — chọn slug khác hoặc dùng categoryId", HttpStatus.CONFLICT);
    }
    const created = await this.prisma.category.create({
      data: {
        name: parsed.data.newCategory.name,
        slug: parsed.data.newCategory.slug,
        schemaConfig: parsed.data.newCategory.schemaConfig as Prisma.InputJsonValue,
        status: "ACTIVE"
      }
    });
    categoryId = created.id;
  }

  const updated = await this.prisma.campaign.update({
    where: { id },
    data: {
      categoryId,
      filterRules: parsed.data.filterRules as Prisma.InputJsonValue,
      status: "APPROVED"        // explicit set, dù STORY-02 đã set khi sync
    }
  });

  return { campaign: updated, categoryId };
}
```

### AC5 — Endpoint preview filter (optional)

File: [admin.controller.ts](../../../../apps/api/src/modules/admin/admin.controller.ts)

```ts
@Post("campaigns/:id/preview-filter")
async previewFilter(
  @Param("id") id: string,
  @Body() payload: unknown,           // filterRules tạm để test, không lưu DB
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["admin"]);
  const parsed = filterRulesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
  }
  const campaign = await this.prisma.campaign.findUnique({ where: { id } });
  if (!campaign?.atCampaignId) throw new HttpException("Campaign chưa có atCampaignId", HttpStatus.BAD_REQUEST);

  const offers = await this.accesstrade.fetchProducts({
    campaign: campaign.atCampaignId,
    limit: 50,
    discountRateFrom: parsed.data.minDiscountPercent,
    discountRateTo: parsed.data.maxDiscountPercent,
    priceFrom: parsed.data.priceMin,
    priceTo: parsed.data.priceMax,
    statusDiscount: parsed.data.status_discount
  });
  // Apply domain filter client side
  const filtered = parsed.data.domains?.length
    ? offers.filter((o) => {
        try { return parsed.data.domains!.some((d) => new URL(o.affiliateUrl).hostname.includes(d)); }
        catch { return false; }
      })
    : offers;

  return {
    matched: filtered.length,
    total: offers.length,
    sample: filtered.slice(0, 5).map((o) => ({
      name: o.name,
      price: o.price,
      discountPercent: o.discountPercent,
      image: o.image
    }))
  };
}
```

Inject `AccesstradeClient` vào AdminController. Optional cho v1; có thể skip để rút estimate xuống 4h.

### AC6 — Action button trong RowActions

File: [campaigns-table.tsx](../../../../apps/web/app/admin/campaigns/campaigns-table.tsx)

Trong RowActions menu (3 chấm), thêm:
- "Assign Category" (mở AssignCategoryDialog).
- "Edit Filter Rules" (mở cùng dialog, mode edit — nếu đã có categoryId thì giữ category, chỉ edit rules).
- "View AT Details" (mở read-only dialog hiển thị `atRawData`, logo, description HTML — dùng `dangerouslySetInnerHTML` đã sanitize).
- "Run crawler cho campaign này" (gọi endpoint `/admin/crawler/run-campaign/:atCampaignId` từ STORY-03 AC6).

Convention `RowActions` xem [apps/web/components/admin/ui/](../../../../apps/web/components/admin/ui/) — nếu chưa có pattern thì dùng dropdown của shadcn.

### AC7 — Filter UI cho list

Top của page `/admin/campaigns`:
- Filter "Status assignment": **All** | **Đã assign** | **Chưa assign**.
- Filter "Status approve": All | APPLIED | APPROVED | PAUSED | REJECTED | INACTIVE.
- Search merchant name.

Default mở vào page: **Chưa assign** (admin focus vào việc onboard).

### AC8 — Empty state khi chưa có campaign

Nếu DB chưa có Campaign nào (lần đầu admin vào):
- Hiển thị block lớn: "Chưa có campaign nào. Apply trên https://pub2.accesstrade.vn → đợi duyệt → quay lại đây và bấm Sync."
- Button "Sync from Accesstrade" (đã có ở STORY-02).
- Link doc [docs/integrations/accesstrade.md](../../../integrations/accesstrade.md) cho dev/admin tham khảo.

## Technical breakdown

### Files mới
- `apps/web/app/admin/campaigns/assign-category-dialog.tsx` — dialog assign + edit rules + `assignCategoryFormSchema` (zod).
- `apps/web/lib/admin/filter-rules.schema.ts` — mirror zod của `filterRulesSchema` (STORY-01) cho client-side validate.
- `apps/web/app/admin/campaigns/at-details-dialog.tsx` — view raw AT data (optional).
- Có thể tách `apps/web/app/admin/campaigns/actions.ts` cho campaign-specific actions thay vì gộp vào file actions chung.

### Files sửa
- `apps/web/app/admin/campaigns/campaigns-table.tsx` — cột mới + RowActions menu.
- `apps/web/app/admin/campaigns/page.tsx` — filter UI + empty state.
- `apps/api/src/modules/admin/admin.controller.ts` — endpoint `/assign` + `/preview-filter`.
- `apps/api/src/modules/admin/admin.module.ts` — nếu cần inject `AccesstradeClient` (kiểm tra module imports).
- `apps/web/lib/admin/constants.ts` — thêm magic string nếu có (eg labels "Assign Category", "Chưa assign", ...).

### Files KHÔNG sửa
- Schema (`prisma/schema.prisma`) — đã đủ field.
- `crawler.service.ts` — Story 03 đã handle.

## API contract

**`POST /api/v1/admin/campaigns/:id/assign`**

Body:
```ts
{
  categoryId?: string;          // UUID, nếu assign category cũ
  newCategory?: {               // nếu tạo category mới
    name: string;
    slug: string;
    schemaConfig: object;
  };
  filterRules: {                // bắt buộc
    minDiscountPercent?: number;
    maxDiscountPercent?: number;
    domains?: string[];
    priceMin?: number;
    priceMax?: number;
    status_discount?: 0 | 1;
  };
}
```

Response 200:
```json
{
  "campaign": { ... },
  "categoryId": "uuid"
}
```

Response 400: validation fail (zod flatten).
Response 404: campaign không tồn tại.
Response 409: slug category mới đã tồn tại.

**`POST /api/v1/admin/campaigns/:id/preview-filter`**

Body: `filterRules` (giống trên).

Response 200:
```json
{
  "matched": 23,
  "total": 50,
  "sample": [{ "name": "...", "price": 1500000, "discountPercent": 25, "image": "..." }]
}
```

## Definition of Done

- [ ] Vào `/admin/campaigns` thấy table với logo, AT category, assigned category (badge "Chưa assign" nếu null), filter rules summary.
- [ ] Bấm "Sync from Accesstrade" → list mới (lấy từ STORY-02).
- [ ] Bấm "Assign Category" trên 1 row → dialog mở, có 2 mode (existing/new).
- [ ] Submit với existing category → campaign update categoryId + filterRules, table refresh.
- [ ] Submit với new category → tạo Category mới + assign campaign vào.
- [ ] Form validate với `assignCategoryFormSchema`: bỏ trống name/slug → lỗi inline; slug `Foo Bar` → lỗi regex; `schemaConfig` rỗng → lỗi "cần ít nhất 1 field".
- [ ] Filter "Chưa assign" default lúc vào page → admin biết ngay phải làm gì.
- [ ] Empty state nếu DB trống.
- [ ] Run crawler từ RowActions thấy log "Campaign X: fetched N" trong api console.
- [ ] `npm run build` pass cho cả 2 app.
- [ ] Build error reproducible bằng `npm run lint:web`.

## Out of scope

- **Bulk assign** (chọn nhiều campaign cùng assign 1 category): để pha sau khi nhu cầu thực sự xuất hiện.
- **Drag-drop campaign giữa category**: UI nice-to-have.
- **Lịch sử thay đổi filterRules**: chỉ giữ current state, không audit log. Lịch sử sẽ ở git/prisma migration nếu admin tools cần.
- **Preview filter realtime** khi gõ form: chỉ load preview khi bấm nút "Preview". Realtime tốn rate limit AT.
- **Edit metadata AT thủ công** (override logo, description...): KHÔNG. AT sync overwrite. Nếu admin muốn override branding → dùng Category.seoTitle/seoDescription.
- **Cron auto-sync campaigns**: chưa cần. Admin tự bấm Sync khi apply campaign mới. Story sau có thể add cron 24h.

## Notes cho AI agent

- **Convention admin UI tuyệt đối**: đọc memory `project_admin_ui_conventions.md` + [apps/web/components/admin/ui/index.ts](../../../../apps/web/components/admin/ui/index.ts) trước khi viết. KHÔNG tạo `/admin/campaigns/[id]/edit/page.tsx` — dùng `FormDialog`.
- **Magic string**: labels/placeholder lấy từ [constants.ts](../../../../apps/web/lib/admin/constants.ts). Nếu chưa có entry, thêm vào — đừng inline string.
- **Sanitize HTML khi render `atRawData.description`**: dùng `DOMPurify` hoặc strip với `cheerio`. Tuyệt đối không `dangerouslySetInnerHTML` raw.
- **`schemaConfig` default cho category mới**: dùng template tối thiểu hợp lý, vd `{ "price": "number", "image": "string", "highlights": "string[]" }`. Admin sẽ edit chi tiết hơn trong /admin/categories sau.
- **Toast**: thành công xanh, lỗi đỏ. Match style các admin page khác.
- **Validate slug client-side**: regex `^[a-z0-9-]+$`. Auto-slugify từ name bằng helper [apps/api/src/utils/slug.util.ts](../../../../apps/api/src/utils/slug.util.ts) — copy logic sang web hoặc import (nếu shared package có sẵn).
- **Form chiếm chiều cao**: nhiều field → dialog có thể scroll. Dùng `max-h-[80vh] overflow-y-auto` cho dialog body.
- **Race condition khi sync + assign cùng lúc**: nếu admin đang trong dialog assign mà ai đó bấm Sync → campaign data có thể update ngầm. Chấp nhận, không lock. Save sẽ overwrite atRawData mới nhất (không quan trọng — admin chỉ care categoryId + filterRules).
- **Field `atCampaignId` của campaign mới sync xong có thể là null** (nếu STORY-02 fail cho row đó). UI check: nếu `!atCampaignId` → disable Assign button, tooltip "Cần sync từ AT trước".
