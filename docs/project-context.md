# Project Context & AI Coding Rules — dealvault

> Auto-loaded by BMAD dev/create-story as persistent facts (`**/project-context.md`). Binding rules for ANY AI implementing in this repo. Source of truth: the `CLAUDE.md` files + `schema.prisma` — read them when in doubt.

## Quy tắc tối thượng
- **Mirror pattern hiện có (consistency là số 1)**: TRƯỚC khi viết bất kỳ file/endpoint/component/service mới → tìm cái tương đương gần nhất đã có trong repo, **copy đúng cấu trúc** (imports, thứ tự, cách validate, error handling, naming, cách inject). KHÔNG tự chế khi đã có mẫu.
- **Phải khai báo nguồn mirror**: khi code, nêu rõ "theo pattern ở `<file:line>`" để người review verify. Nếu không tìm được mẫu tương đương → DỪNG, hỏi user thay vì tự sáng tạo.
- Rule repo (CLAUDE.md/project-context) > convention generic của BMAD.
- TypeScript strict, **không `any`**. Trùng style: theo ESLint/Prettier sẵn có, không tự đặt style mới.
- Sau khi sửa `apps/api/prisma/schema.prisma` → `npm run db:migrate -- --name <slug>` (KHÔNG sửa DB tay). Migrations là 1 baseline `0_init`; thay đổi mới = migration additive.

## Invariants tuyệt đối (phá = hỏng doanh thu/brand-trust)
- **trackingCode** = `randomUUID().replace(/-/g,"")` (32 ký tự). Round-trip: click → `ClickLog` → `?utm_source=` → `ConversionWebhook`. KHÔNG đổi format/round-trip.
- **HITL gate**: `ProductExtraction` (DRAFT_RAW | PENDING_REVIEW | PUBLISHED | ERROR), `Article` (DRAFT | PUBLISHED | ARCHIVED), `Coupon` (`isActive`). Không gì ra storefront khi chưa người duyệt. **Không auto-publish.**
- **Admin auth** = header `x-admin-role` + `x-admin-key`; `ADMIN_API_KEY` khớp giữa 2 app; `authorize()` per-method (least-privilege).
- **`Niche.schemaConfig`** per-niche động; web đọc `scrapedData` **chỉ qua `normalizeProduct`**; api không hard-code field name.

## apps/api (NestJS 10)
- Prefix `/api/v1` (đừng hard-code trong controller decorator). Global `ValidationPipe`.
- Inject `PrismaService`, **không** `new PrismaClient()`.
- Public endpoint: **class-validator DTO**. Admin endpoint: **zod + `authorize()`**. Không trộn 2 thứ trong 1 controller.
- AI qua `AiService` (1 attempt ở stage level, **không tự wrap retry**). Dùng `Prisma.InputJsonValue` cho cột Json.
- 1 feature module / concern. Crawler là per-campaign loop, `filterRules` push xuống AT datafeed.

## apps/web (Next.js 15)
- **RSC mặc định**; `"use client"` chỉ khi cần browser API / state / event.
- Server action: `app/actions/tracking.ts` (public — **KHÔNG refactor token shape**) + `app/admin/actions.ts` (`adminFetch`/`post` + kết thúc bằng `revalidatePath`).
- Đọc `scrapedData` qua `normalizeProduct` → `ProductView`. `formatMoney` cho tiền VND. `cn()` cho className.
- SEO load-bearing: `sitemap.ts`, `robots.ts` (block `/admin`), JSON-LD Product/Offer/Article, ISR 300. URL `/categories/[slug]` giữ cho SEO (entity = `Niche`).

## Test / gate
- api: Jest (`npm run test:api`). web: chưa có suite → `lint` + `build` là gate (`npm run lint:web`, `npm run build`).
- Trước khi báo done: `npm run lint:web` + `npm run test:api` + `npm run build`.

## Đọc thêm
- Rule đầy đủ: [CLAUDE.md](../CLAUDE.md), [apps/api/CLAUDE.md](../apps/api/CLAUDE.md), [apps/web/CLAUDE.md](../apps/web/CLAUDE.md).
- Kiến trúc/data: [architecture-api.md](./architecture-api.md), [architecture-web.md](./architecture-web.md), [data-models.md](./data-models.md), [index.md](./index.md).
- Business + product direction: [CONTEXT.md](./CONTEXT.md).
