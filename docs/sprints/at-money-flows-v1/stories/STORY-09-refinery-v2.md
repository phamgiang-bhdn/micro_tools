# STORY-09 — Refinery v2: bulk approve + auto-approve high-confidence

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 5h
**Dependencies:** STORY-01 (AT-only cleanup). STORY-03 (admin re-org có sub-link Refinery).

## Context

Refinery hiện tại (`/admin/refinery`) yêu cầu operator approve **1-by-1**:
- 50 product = 25-30 phút (30s mỗi row review).
- Mỗi row có keyboard shortcut `j`/`k` (move), `a` (approve), `r` (reject) — đã tốt.
- Nhưng operator gà mờ ko biết product nào "rất rõ ràng OK" vs "cần soi kỹ" → review hết bằng nhau.

**Vấn đề thực tế**:
- 70-80% product đã đủ rõ ràng OK (có ảnh, có giá hợp lý, store Mall/Trading, discount ≥15%, name không spam ký tự).
- 20-30% còn lại mới cần human eye.

**Giải pháp**:
1. **Confidence scoring** auto-compute mỗi product khi crawler import.
2. **Auto-approve threshold**: product với `confidence ≥ 80` AND extraction success → tự `PUBLISHED` (skip refinery queue).
3. **Bulk approve N**: operator chọn nhiều row + 1 button approve.
4. **Refinery queue chỉ show product confidence < 80** = chỉ phần cần human eye → operator review nhanh.
5. **Safety net**: operator có thể "Unapprove" trong 24h nếu nhầm — set `isPublic=false`, log event.

## User story

> **As** operator gà mờ approve 50-100 product mỗi sáng,
> **I want** hệ thống auto-pass 70% product rõ ràng OK + bulk approve còn lại,
> **so that** tôi review trong 3-5 phút thay vì 25 phút.

## Acceptance criteria

### AC1 — Confidence scoring service

NEW: `apps/api/src/modules/refinery/confidence.service.ts`.

```ts
@Injectable()
export class ConfidenceService {
  /**
   * Compute confidence 0-100 cho 1 product.
   *
   * Rules (additive scoring, max 100):
   * - Có image URL valid: +20
   * - Có price > 0 + originalPrice > price: +20
   * - Discount ≥ 15%: +15
   * - Discount ≥ 30%: +5 (additional)
   * - Store badge Mall/Trading/Official: +20
   * - Brand identified: +10
   * - Title clean (no special chars overuse, ≤120 chars): +10
   * - Schema fields match niche schemaConfig ≥ 50%: +10
   * - Sales data present (salesCount > 10): +5
   *
   * Penalty:
   * - Title contains spam markers (★★★, FREESHIP HÔM NAY!!!): -20
   * - Price < 50k (likely fake): -30
   * - No image: -40 (effectively block auto-approve)
   * - No price: -40
   */
  compute(product: Product, niche: Niche): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const sd = product.scrapedData as Record<string, unknown>;

    // Image
    const image = pickString(sd, ["image", "imageUrl", "thumbnail"]);
    if (image && /^https?:\/\//.test(image)) {
      score += 20;
      reasons.push("+20 ảnh OK");
    } else {
      score -= 40;
      reasons.push("-40 thiếu ảnh");
    }

    // Price
    const price = pickNumber(sd, ["price", "salePrice", "currentPrice"]);
    const originalPrice = pickNumber(sd, ["originalPrice", "listPrice"]);
    if (price && price > 0) {
      score += 20;
      reasons.push("+20 có giá");
      if (originalPrice && originalPrice > price) {
        const discount = Math.round((1 - price / originalPrice) * 100);
        if (discount >= 15) { score += 15; reasons.push(`+15 giảm ${discount}%`); }
        if (discount >= 30) { score += 5; reasons.push(`+5 giảm sâu ≥30%`); }
      }
      if (price < 50000) {
        score -= 30;
        reasons.push("-30 giá quá thấp (< 50k, có thể fake)");
      }
    } else {
      score -= 40;
      reasons.push("-40 thiếu giá");
    }

    // Store badge
    const store = (pickString(sd, ["store", "merchant"]) ?? "").toLowerCase();
    if (/mall|trading|official|preferred/.test(store)) {
      score += 20;
      reasons.push("+20 shop chính hãng (Mall/Trading)");
    }

    // Brand
    const brand = pickString(sd, ["brand"]);
    if (brand && brand.length >= 2) {
      score += 10;
      reasons.push("+10 có brand");
    }

    // Title clean
    const title = product.name;
    if (title.length > 0 && title.length <= 120 && !/★{2,}|!{3,}|【.+】/.test(title)) {
      score += 10;
      reasons.push("+10 title sạch");
    }
    if (/★{2,}|!{3,}|FREESHIP\s+HÔM NAY|【.+】/.test(title)) {
      score -= 20;
      reasons.push("-20 title spam ký tự");
    }

    // Schema match
    const schemaConfig = niche.schemaConfig as Record<string, string>;
    if (schemaConfig) {
      const requiredFields = Object.keys(schemaConfig);
      const matched = requiredFields.filter(k => sd[k] !== undefined && sd[k] !== null);
      const ratio = requiredFields.length > 0 ? matched.length / requiredFields.length : 0;
      if (ratio >= 0.5) {
        score += 10;
        reasons.push(`+10 schema match ${Math.round(ratio*100)}%`);
      }
    }

    // Sales data
    const salesCount = pickNumber(sd, ["salesCount", "sold", "soldCount"]);
    if (salesCount && salesCount > 10) {
      score += 5;
      reasons.push(`+5 đã bán ${salesCount}+`);
    }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}
```

### AC2 — Schema: ProductExtraction extend

`apps/api/prisma/schema.prisma`:

```prisma
model ProductExtraction {
  // ... existing ...
  confidenceScore  Int?                                  // 0-100, computed
  confidenceReasons Json?  @db.JsonB                     // array of strings
  autoApproved     Boolean  @default(false)
  autoApprovedAt   DateTime?
  reviewedAt       DateTime?
  reviewedBy       String?                               // admin role/email
  unapprovedAt     DateTime?                             // soft un-approve trong 24h

  @@index([confidenceScore])
  @@index([autoApproved])
}
```

Migration: `npm run db:migrate -- --name add_refinery_confidence_score`.

### AC3 — Hook confidence vào crawler import

File: `apps/api/src/modules/crawler/import.service.ts`.

Khi upsert product mới → compute confidence → save vào `ProductExtraction`:

```ts
async upsertOffer(offer: NormalizedOffer, campaign: Campaign, niche: Niche) {
  // ... existing upsert logic ...

  const confidence = this.confidenceService.compute(product, niche);

  // Auto-approve gate
  const AUTO_APPROVE_THRESHOLD = parseInt(process.env.REFINERY_AUTO_APPROVE_THRESHOLD ?? "80");
  const shouldAutoApprove = confidence.score >= AUTO_APPROVE_THRESHOLD;

  await this.prisma.productExtraction.upsert({
    where: { productId: product.id },
    create: {
      productId: product.id,
      status: shouldAutoApprove ? "PUBLISHED" : "PENDING_REVIEW",
      confidenceScore: confidence.score,
      confidenceReasons: confidence.reasons,
      autoApproved: shouldAutoApprove,
      autoApprovedAt: shouldAutoApprove ? new Date() : null,
      scrapedData: product.scrapedData,
      aiOutput: null
    },
    update: {
      confidenceScore: confidence.score,
      confidenceReasons: confidence.reasons
      // Don't change status if already reviewed
    }
  });

  // If auto-approved, also flip Product.isPublic
  if (shouldAutoApprove) {
    await this.prisma.product.update({
      where: { id: product.id },
      data: { isPublic: true }
    });
  }
}
```

ENV: `REFINERY_AUTO_APPROVE_THRESHOLD` (default 80) — operator có thể tweak.

### AC4 — Backfill confidence cho existing data

Migration script (chạy 1 lần sau migration AC2):

NEW: `apps/api/scripts/backfill-confidence.mjs`:

```js
import { PrismaClient } from "@prisma/client";
import { ConfidenceService } from "../src/modules/refinery/confidence.service.js";

const prisma = new PrismaClient();
const confidence = new ConfidenceService();

async function main() {
  const extractions = await prisma.productExtraction.findMany({
    where: { confidenceScore: null },
    include: { product: { include: { niche: true } } }
  });
  console.log(`Backfilling ${extractions.length} extractions...`);

  let auto = 0;
  for (const ex of extractions) {
    if (!ex.product || !ex.product.niche) continue;
    const result = confidence.compute(ex.product, ex.product.niche);
    const shouldAuto = result.score >= 80 && ex.status === "PENDING_REVIEW";
    await prisma.productExtraction.update({
      where: { id: ex.id },
      data: {
        confidenceScore: result.score,
        confidenceReasons: result.reasons,
        autoApproved: shouldAuto,
        autoApprovedAt: shouldAuto ? new Date() : ex.autoApprovedAt,
        status: shouldAuto ? "PUBLISHED" : ex.status
      }
    });
    if (shouldAuto) {
      await prisma.product.update({ where: { id: ex.productId }, data: { isPublic: true } });
      auto++;
    }
  }
  console.log(`Backfilled. Auto-approved ${auto} of ${extractions.length}`);
}

main().finally(() => prisma.$disconnect());
```

Run: `node apps/api/scripts/backfill-confidence.mjs` sau khi merge migration.

### AC5 — Refinery list UI: filter + tabs

File: `apps/web/components/admin/refinery/refinery-list.tsx` (verify path).

Refactor:

```
┌──────────────────────────────────────────────────────┐
│ Refinery — Duyệt sản phẩm                            │
│                                                      │
│ Tabs:                                                │
│ [Cần xem mắt (12)] [Tự auto-duyệt (8 mới)] [Tất cả] │
└──────────────────────────────────────────────────────┘
```

Tab "Cần xem mắt": filter `confidenceScore < 80 OR confidenceScore IS NULL`. Default tab.

Tab "Tự auto-duyệt": filter `autoApproved = true AND autoApprovedAt >= now - 24h`. Show banner "Hệ thống tự duyệt 8 sản phẩm. Nếu thấy sai, click 'Bỏ duyệt'."

Tab "Tất cả": tất cả pending + auto-approved + reviewed (legacy support).

### AC6 — Bulk approve UI

Trong tab "Cần xem mắt":

- Checkbox column bên trái mỗi row.
- Header có "Chọn tất cả".
- Floating action bar khi có row selected:

```
┌──────────────────────────────────────────────┐
│ ✓ 5 sản phẩm đã chọn                         │
│ [Duyệt nhanh tất cả →]  [Bỏ chọn]           │
└──────────────────────────────────────────────┘
```

Click "Duyệt nhanh tất cả" → POST `/admin/refinery/bulk-approve` body `{ ids: [...] }`.

Endpoint:

```ts
@Post("refinery/bulk-approve")
async bulkApprove(@Body() body, ...auth) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);
  const parsed = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(body);
  const result = await this.prisma.$transaction(async tx => {
    await tx.productExtraction.updateMany({
      where: { id: { in: parsed.ids } },
      data: { status: "PUBLISHED", reviewedAt: new Date(), reviewedBy: role }
    });
    const extractions = await tx.productExtraction.findMany({ where: { id: { in: parsed.ids } } });
    await tx.product.updateMany({
      where: { id: { in: extractions.map(e => e.productId) } },
      data: { isPublic: true }
    });
    return extractions.length;
  });
  return { ok: true, approved: result };
}
```

### AC7 — Auto-approved warning + un-approve

Trong tab "Tự auto-duyệt":

- Banner top: "Hệ thống tự duyệt sản phẩm có confidence ≥ 80. Bạn vẫn có thể 'Bỏ duyệt' nếu thấy sai trong 24h."
- Mỗi row có button "Bỏ duyệt" (icon undo).
- Click → POST `/admin/refinery/:id/unapprove` → set `Product.isPublic=false` + `ProductExtraction.status=PENDING_REVIEW + unapprovedAt=now`.

Endpoint:

```ts
@Post("refinery/:id/unapprove")
async unapprove(@Param("id") id: string, ...auth) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);
  const ex = await this.prisma.productExtraction.findUnique({ where: { id } });
  if (!ex || !ex.autoApproved) throw new HttpException("Not auto-approved", HttpStatus.BAD_REQUEST);
  if (ex.autoApprovedAt && Date.now() - ex.autoApprovedAt.getTime() > 24 * 3600 * 1000) {
    throw new HttpException("Cannot un-approve after 24h", HttpStatus.BAD_REQUEST);
  }
  await this.prisma.$transaction([
    this.prisma.productExtraction.update({
      where: { id },
      data: { status: "PENDING_REVIEW", unapprovedAt: new Date() }
    }),
    this.prisma.product.update({ where: { id: ex.productId }, data: { isPublic: false } })
  ]);
  return { ok: true };
}
```

### AC8 — Confidence display per row

Mỗi row trong refinery list show confidence score + 2-3 reason chính:

```
┌──────────────────────────────────────────────────────┐
│ [□] [img] Robot Roborock S7 Pro Ultra               │
│           8,990,000 VND  -67%  ★4.8 1.2k đã mua     │
│           Confidence: 92 ✓ (auto-duyệt)              │
│           +20 ảnh OK • +20 giá hợp lý • +20 LazMall  │
│           [Duyệt] [Bỏ] [Xem chi tiết]               │
└──────────────────────────────────────────────────────┘
```

Color tier:
- ≥80 (green) — auto-approved.
- 60-79 (amber) — likely OK, operator review.
- <60 (red) — needs careful review.

### AC9 — Keyboard shortcut update

Giữ shortcuts hiện tại: `j`/`k` move, `a` approve, `r` reject.

Thêm:
- `Space` toggle checkbox (bulk select).
- `Shift+A` bulk approve all selected.
- `Esc` clear selection.
- `?` show shortcuts help overlay.

### AC10 — Refinery count badge update (STORY-03)

Update `GET /admin/queues/counts` để chỉ count "Cần xem mắt" (không count auto-approved):

```ts
refinery: await this.prisma.productExtraction.count({
  where: { status: "PENDING_REVIEW" }  // auto-approved đã ko PENDING_REVIEW
})
```

Hiển thị widget Today queue: "Duyệt sản phẩm (12 mới, 8 đã auto)" → "12" là cần xem, "8" là auto-approved info.

## Files touched

```
apps/api/prisma/schema.prisma                                   (ProductExtraction extension)
apps/api/prisma/migrations/<ts>_add_refinery_confidence_score/  (NEW)
apps/api/src/modules/refinery/refinery.module.ts                (NEW or extend)
apps/api/src/modules/refinery/confidence.service.ts             (NEW)
apps/api/src/modules/crawler/import.service.ts                  (hook confidence + auto-approve)
apps/api/src/modules/admin/admin.controller.ts                  (bulk-approve + unapprove endpoints)
apps/api/scripts/backfill-confidence.mjs                        (NEW)
apps/api/.env.example                                           (REFINERY_AUTO_APPROVE_THRESHOLD=80)
apps/web/components/admin/refinery/refinery-list.tsx            (refactor with tabs + bulk + confidence display)
apps/web/components/admin/refinery/confidence-chip.tsx          (NEW)
apps/web/components/admin/refinery/bulk-actions-bar.tsx         (NEW)
apps/web/app/admin/refinery/actions.ts                          (add bulkApprove + unapprove server actions)
```

## Verification

```bash
# 1. Migration + backfill
npm run db:migrate -- --name add_refinery_confidence_score
node apps/api/scripts/backfill-confidence.mjs

# 2. New product import auto-confidence
curl -X POST http://localhost:4000/api/v1/admin/sync/crawler -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# psql -c "SELECT name, status, confidenceScore, autoApproved FROM ProductExtraction LIMIT 10"
# expect: rows có confidenceScore populated, autoApproved=true for ≥80

# 3. Refinery list tab filter
# Open /admin/refinery → default tab "Cần xem mắt" hiển thị chỉ confidence < 80
# Tab "Tự auto-duyệt" → hiển thị auto-approved 24h gần đây

# 4. Bulk approve
# Tab "Cần xem mắt" → check 3 row → "Duyệt nhanh tất cả" → 3 product PUBLISHED + isPublic=true

# 5. Un-approve
# Tab "Tự auto-duyệt" → click "Bỏ duyệt" → product isPublic=false, back to PENDING_REVIEW

# 6. Confidence display
# Each row visible: score chip + top reasons

# 7. Threshold tweak
# Set REFINERY_AUTO_APPROVE_THRESHOLD=90
# Trigger new crawler run → only score ≥90 auto-approved

# 8. Cannot un-approve after 24h
# Manually set autoApprovedAt = 25h ago → API call returns 400
```

## Definition of done

- [ ] `ConfidenceService.compute` deterministic, max 100, min 0.
- [ ] Auto-approve threshold via env (default 80).
- [ ] Import hook compute + auto-flip isPublic.
- [ ] Backfill script chạy 1 lần OK.
- [ ] Tab "Cần xem mắt" / "Tự auto-duyệt" / "Tất cả" filter đúng.
- [ ] Bulk approve N (max 100) via 1 API call.
- [ ] Unapprove trong 24h work, 401 sau 24h.
- [ ] Confidence chip + reasons display per row.
- [ ] Keyboard shortcuts polished.
- [ ] Today queue badge count "Cần xem mắt" only.
- [ ] Operator có thể approve 50 product trong ≤5 phút (test thật).

## Notes for next session

- Rule scoring có thể tinh chỉnh sau khi có data — ví dụ thêm "discount > 70% → -10 (suspicious)".
- AI confidence: tương lai có thể dùng LLM judge ("Đây có phải product hợp lệ không? 0-1 score") thay vì rule-based. Defer.
- Auto-approve KHÔNG bypass HITL philosophy — operator vẫn có 24h soft un-approve. Sau 24h, audit trail giữ trong DB.
- Reason translation: "+20 ảnh OK" có thể i18n. Hiện hard-code VN.
- Bulk approve có thể slow nếu 100 row × tx — verify performance test.
- Future: bulk reject button, bulk re-extract button.
