# Refactor — Commands user cần chạy

Track các command **destructive / stateful** mà Claude không tự chạy. User chạy manual khi sẵn sàng.

---

## 🔴 Step 1: Apply schema migration (BẮT BUỘC)

Schema mới thêm:
- **Tables**: `Tool`, `QuizSession`, `WaitlistSignup`, `ReasoningCache`, `ToolEmailDrip`
- **Enums**: `ToolStatus (DRAFT | PUBLISHED | ARCHIVED)`, `EmailDripStatus (PENDING | SENT | FAILED | CANCELLED)`
- **`ClickLog`**: thêm `toolId`, `quizSessionId`, `marketplace` + indexes + FK relations
- **`Niche`**: thêm relations `tools Tool[]`, `waitlistSignups WaitlistSignup[]`

**Lệnh:**
```powershell
# Từ root project
npm run db:migrate --workspace api -- --name add_tool_module
```

Lệnh này:
1. Diff `schema.prisma` vs DB hiện tại
2. Tạo file migration `apps/api/prisma/migrations/<timestamp>_add_tool_module/migration.sql`
3. Apply lên DB local
4. Regen Prisma Client

**Pre-check:**
- Docker Postgres phải đang chạy (`docker compose ps` thấy container UP)
- `apps/api/.env` có `DATABASE_URL` đúng

Nếu DB down → `docker compose up -d` (user tự chạy, không phải Claude).

---

## 🟡 Step 2: Re-seed để có sample Tool

```powershell
npm run prisma:seed --workspace api
```

Sau khi seed:
- 100 niche tạo (chỉ `may-loc-nuoc` set `status=ACTIVE`, còn lại INACTIVE)
- 2 `PromptTemplate` mới: `tool.parseUserInput`, `tool.generateReasoning`
- 1 sample `Tool` DRAFT slug=`chon-may-loc-nuoc` (default quiz + scoring cho máy lọc nước)

**Đổi launch niche nếu cần:**
```powershell
$env:LAUNCH_NICHE_SLUG = "may-loc-khong-khi"
npm run prisma:seed --workspace api
```

---

## 🟢 Step 3: Crawl product cho launch niche

Vào Admin `/admin/campaigns` → onboard 3-5 campaign Accesstrade cho `may-loc-nuoc` → run crawler. Sau đó:
- Vào `/admin/refinery` duyệt ≥30 product PENDING_REVIEW → PUBLISHED
- (Nếu cần) Vào `/admin/products/[id]/edit` chỉnh `scrapedData.recommendedHouseholdSize`, `supportedSources`, `priceVnd`, `hotColdFunction`, `marketplaceListings[]` để khớp scoring rules

---

## 🟢 Step 4: Publish Tool

Vào `/admin/tools` → click sample Tool DRAFT → "Publish".
URL public: `/ai/chon-may-loc-nuoc` (hoặc short URL `/loc-nuoc` đã cấu hình trong `next.config.ts`).

Test:
- `/coming-soon/may-loc-nuoc` — pre-launch landing
- `/ai/chon-may-loc-nuoc` — hero hybrid
- `/ai/chon-may-loc-nuoc/quiz` — quiz step-by-step
- `/admin/tools/<id>/preview` — admin test scoring không tạo session
- `/admin/tools/<id>/analytics` — funnel dashboard
- `/admin/waitlist` — email signup viewer

---

## 🟢 Step 5: (Optional) Bật cron jobs

Default OFF — bật bằng env vars trong `apps/api/.env`:

```env
# Inventory check (Story 5.6) — mỗi 6h check OOS via HEAD request
INVENTORY_CHECK_ENABLED=true
INVENTORY_CHECK_CRON=0 */6 * * *

# Email drip (Story 6.5) — mỗi 9h sáng flush PENDING due
EMAIL_DRIP_ENABLED=true

# Resend integration cho email drip thực sự gửi (nếu không set, drip chỉ log to console)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=DealVault <noreply@dealvault.vn>
```

Có thể manually trigger từ Admin:
- `/admin/tools` → button "Inventory check" / "Flush email drip"

---

## 🟢 Step 6: Verify

```powershell
npm run prisma:studio --workspace api
# Mở http://localhost:5555, check thấy:
#   - Tool, QuizSession, WaitlistSignup, ReasoningCache, ToolEmailDrip (5 tables mới)
#   - ClickLog có column toolId, quizSessionId, marketplace
#   - Niche: chỉ may-loc-nuoc status=ACTIVE, còn lại INACTIVE
#   - Tool: 1 row "chon-may-loc-nuoc" status=DRAFT
#   - PromptTemplate: thêm 2 row tool.parseUserInput + tool.generateReasoning
```

Dev server:
```powershell
npm run dev:api   # port 4000
npm run dev:web   # port 3100
```

Test full flow:
1. http://localhost:3100/coming-soon/may-loc-nuoc — submit email
2. Admin publish Tool
3. http://localhost:3100/ai/chon-may-loc-nuoc — làm quiz / chat
4. Click "Mua trên..." → ClickLog created → interstitial → redirect
5. http://localhost:3100/admin/tools/<id>/analytics — verify funnel data

---

## Rollback nếu cần

```powershell
# Rollback migration cuối (chỉ DEV — không dùng prod):
cd apps/api
npx prisma migrate resolve --rolled-back add_tool_module

# Hoặc reset toàn bộ DB + re-seed (NUKES DATA):
cd ../../
npm run db:reset
```

---

## TypeScript verify (không strict required)

Code đã viết assume Prisma client regenerated sau migration. Trước migration sẽ có TS errors về `Tool`, `QuizSession`, etc. — bình thường, sẽ fix tự động sau `db:migrate`.

Nếu muốn regen client mà chưa migrate (cho IDE):
```powershell
npm run prisma:generate --workspace api
```

---

## Documentation

- [`docs/REFACTOR-PLAN.md`](REFACTOR-PLAN.md) — full 28+ story breakdown
- [`docs/CONTEXT.md`](CONTEXT.md) — product strategy (đọc trước khi đụng storefront/admin)
- [`CLAUDE.md`](../CLAUDE.md) — monorepo invariants
- [`apps/api/CLAUDE.md`](../apps/api/CLAUDE.md) — Nest patterns
- [`apps/web/CLAUDE.md`](../apps/web/CLAUDE.md) — Next 15 patterns
