# STORY-04 — Commission rank + Keyword radar (Loop 1+2): "Cơ hội tuần" widget

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 5h
**Money loop:** Loop 1 — "Hôm nay viết gì kiếm tiền nhất?"
**Dependencies:** STORY-02 (sync orchestrator để gọi vào). STORY-03 (placeholder widget chỗ mount).

## Context

**Vấn đề**: Operator viết article ngẫu nhiên không có guideline.

**Giải pháp**: AT có 2 endpoint cho biết "viết gì kiếm tiền nhất":

1. **`GET /v1/cashback/campaigns`** — trả `min/max_commission` per campaign + `all_commissions` breakdown per sub-category. Operator biết "Lazada trả 8% beauty, 2% electronics. Shopee 5% beauty, 4% electronics" → pick combo niche × merchant cao nhất.

2. **`GET /v1/offers_informations/keyword_list`** — trả từ khoá đang hot trên AT (search volume + total_offer). Operator biết "shopee video sale 5.5" trending → publish article kịp.

Combine 2 signal:
- Cashback rank → "ngành nào trả nhiều?"
- Keyword radar → "ngành nào đang search?"
- Cross: "ngành trả nhiều + đang search + chưa có article" = **GOLDEN OPPORTUNITY**

Widget "Cơ hội tuần" hiển thị top 5 opportunity. Click 1 hàng → form "Tạo bài mới" tự fill niche + topic + product hints + AI prompt hint commission.

**Trigger pattern**: lazy fetch — admin mở dashboard → check cache, nếu >7 ngày thì re-fetch + cache. Operator có nút "Refresh ngay" force. Cũng được hook vào `POST /admin/sync/all` mega-button (STORY-02).

## User story

> **As** gà mờ operator mở admin sáng thứ 2,
> **I want** thấy ngay 5 opportunity tuần này (niche × merchant trả nhiều + keyword hot), 1 click tạo bài,
> **so that** tôi không cần brainstorm + research thủ công, content velocity tăng.

## Acceptance criteria

### AC1 — Schema migration: CommissionRank + KeywordTrend

`apps/api/prisma/schema.prisma`:

```prisma
model CommissionRank {
  id                String   @id @default(uuid()) @db.Uuid
  atCampaignId      String                              // tham chiếu Campaign.atCampaignId
  campaignName      String
  merchant          String                              // merchant slug
  atCategoryName    String?                             // top-level category
  atSubCategoryName String?                             // sub-category (specific niche-ish)
  minCommission     Float                               // %
  maxCommission     Float                               // %
  commissionType    String                              // "percentage" | "fixed"
  allCommissions    Json                                // breakdown từ AT response
  fetchedAt         DateTime @default(now())
  syncBatchId       String                              // group rows fetch cùng lúc, dùng để purge old

  @@index([syncBatchId])
  @@index([maxCommission])
  @@index([atCampaignId])
}

model KeywordTrend {
  id              String   @id @default(uuid()) @db.Uuid
  atKeywordId     String   @unique                     // id format "<merchant>-<keyword_id>"
  iconText        String                              // text keyword thực tế ("shopee video sale 5.5")
  merchant        String
  totalOffer      Int                                  // số offer khớp keyword
  fetchedAt       DateTime @default(now())
  syncBatchId     String

  @@index([syncBatchId])
  @@index([totalOffer])
}

// Mapping keyword tới niche được match (computed, để cache cross-ref)
model KeywordNicheMatch {
  id              String   @id @default(uuid()) @db.Uuid
  keywordTrendId  String   @db.Uuid
  keyword         KeywordTrend @relation(fields: [keywordTrendId], references: [id], onDelete: Cascade)
  nicheId         String?  @db.Uuid
  niche           Niche?   @relation(fields: [nicheId], references: [id], onDelete: SetNull)
  matchScore      Float                                // 0-1
  matchReason     String?

  @@index([nicheId])
}
```

Migration: `npm run db:migrate -- --name add_commission_keyword_tables`.

### AC2 — Extend AccesstradeClient

File: `apps/api/src/modules/crawler/clients/accesstrade.client.ts`.

Add 2 method:

```ts
async fetchCashbackCampaigns(opts: { page?: number; pageSize?: number; sortBy?: "min_commission" | "max_commission"; sortOrder?: "asc" | "desc" }): Promise<CashbackCampaignsResponse> {
  const params = new URLSearchParams({
    page: String(opts.page ?? 1),
    page_size: String(opts.pageSize ?? 50),
    ...(opts.sortBy && { sort_by: opts.sortBy }),
    ...(opts.sortOrder && { sort_order: opts.sortOrder })
  });
  const res = await this.httpClient.get(`/v1/cashback/campaigns?${params}`);
  return res.data; // shape doc trong docs/integrations/accesstrade.md mục 3.3
}

async fetchKeywordList(): Promise<KeywordListResponse> {
  const res = await this.httpClient.get("/v1/offers_informations/keyword_list");
  return res.data; // shape doc mục 3.9.2
}
```

DTO `CashbackCampaignsResponse` + `KeywordListResponse` define trong `apps/api/src/modules/crawler/clients/accesstrade-dto.ts`.

### AC3 — CommissionRankService

NEW: `apps/api/src/modules/insights/commission-rank.service.ts`.

```ts
@Injectable()
export class CommissionRankService {
  constructor(
    private prisma: PrismaService,
    private accesstrade: AccesstradeClient,
    private syncStatus: SyncStatusService
  ) {}

  async refresh(): Promise<{ fetched: number; saved: number }> {
    return this.syncStatus.wrap("commission_rank", async () => {
      const batchId = `batch_${Date.now()}`;
      let totalFetched = 0;
      let saved = 0;

      // Paginate /v1/cashback/campaigns
      for (let page = 1; page <= 5; page++) { // max 5 page × 50 = 250 campaign rank
        const res = await this.accesstrade.fetchCashbackCampaigns({ page, pageSize: 50, sortBy: "max_commission", sortOrder: "desc" });
        const campaigns = res.data?.campaigns ?? [];
        if (campaigns.length === 0) break;
        totalFetched += campaigns.length;

        for (const c of campaigns) {
          await this.prisma.commissionRank.create({
            data: {
              atCampaignId: c.campaign_id,
              campaignName: c.name,
              merchant: c.merchant,
              atCategoryName: c.category_name,
              atSubCategoryName: c.sub_category,
              minCommission: c.min_commission,
              maxCommission: c.max_commission,
              commissionType: c.commission_type,
              allCommissions: c.all_commissions as Prisma.InputJsonValue,
              syncBatchId: batchId
            }
          });
          saved++;
        }

        // Sleep 1s giữa page để khỏi AT rate-limit
        if (campaigns.length === 50) await new Promise(r => setTimeout(r, 1000));
      }

      // Purge old batch
      await this.prisma.commissionRank.deleteMany({
        where: { syncBatchId: { not: batchId } }
      });

      return { fetched: totalFetched, saved };
    });
  }

  async getTopOpportunities(limit = 10) {
    return this.prisma.commissionRank.findMany({
      orderBy: { maxCommission: "desc" },
      take: limit
    });
  }
}
```

### AC4 — KeywordRadarService

NEW: `apps/api/src/modules/insights/keyword-radar.service.ts`.

```ts
@Injectable()
export class KeywordRadarService {
  constructor(
    private prisma: PrismaService,
    private accesstrade: AccesstradeClient,
    private syncStatus: SyncStatusService
  ) {}

  async refresh(): Promise<{ fetched: number; saved: number; matched: number }> {
    return this.syncStatus.wrap("keyword_radar", async () => {
      const batchId = `batch_${Date.now()}`;
      const res = await this.accesstrade.fetchKeywordList();
      const keywords = res.data ?? [];
      let saved = 0;
      let matched = 0;

      for (const k of keywords) {
        const upserted = await this.prisma.keywordTrend.upsert({
          where: { atKeywordId: k.id },
          create: {
            atKeywordId: k.id,
            iconText: k.icon_text,
            merchant: k.id.split("-")[0] ?? "unknown",
            totalOffer: k.total_offer,
            syncBatchId: batchId
          },
          update: {
            iconText: k.icon_text,
            totalOffer: k.total_offer,
            fetchedAt: new Date(),
            syncBatchId: batchId
          }
        });
        saved++;

        // Compute niche match
        const match = await this.matchKeywordToNiche(k.icon_text);
        if (match) {
          await this.prisma.keywordNicheMatch.create({
            data: {
              keywordTrendId: upserted.id,
              nicheId: match.nicheId,
              matchScore: match.score,
              matchReason: match.reason
            }
          });
          matched++;
        }
      }

      return { fetched: keywords.length, saved, matched };
    });
  }

  private async matchKeywordToNiche(keywordText: string): Promise<{ nicheId: string; score: number; reason: string } | null> {
    // Simple heuristic: keyword text contains niche name (Vietnamese, no-dấu)
    const niches = await this.prisma.niche.findMany();
    const keywordLower = removeDiacritics(keywordText.toLowerCase());
    for (const niche of niches) {
      const slugWords = niche.slug.split("-");
      const matchCount = slugWords.filter(w => keywordLower.includes(w)).length;
      if (matchCount >= 2 || (matchCount === 1 && slugWords.length === 1)) {
        return { nicheId: niche.id, score: matchCount / slugWords.length, reason: `slug words match: ${matchCount}/${slugWords.length}` };
      }
    }
    return null;
  }

  async getTopOpportunities(limit = 10) {
    return this.prisma.keywordTrend.findMany({
      orderBy: { totalOffer: "desc" },
      take: limit,
      include: {
        // join với niche match — hint to operator nên match niche nào
        // Prisma sub-query — implement properly
      }
    });
  }
}
```

`removeDiacritics` util: dùng existing `slugify` hoặc package nhỏ. Vietnamese-aware.

### AC5 — OpportunityService — combine 2 signal

NEW: `apps/api/src/modules/insights/opportunity.service.ts`.

```ts
@Injectable()
export class OpportunityService {
  constructor(
    private prisma: PrismaService,
    private commission: CommissionRankService,
    private keyword: KeywordRadarService
  ) {}

  async getTopOpportunities(limit = 5): Promise<Opportunity[]> {
    // 1. Top 20 commission rank entries
    const commissionRanks = await this.commission.getTopOpportunities(20);

    // 2. Top 30 keyword trend (with niche match)
    const keywords = await this.prisma.keywordTrend.findMany({
      orderBy: { totalOffer: "desc" },
      take: 30,
      include: {
        // need adjusted relation — keyword has one-to-many KeywordNicheMatch
      }
    });

    // 3. Cross-join: pair (cashback rank × keyword) where niche overlaps AND article không tồn tại cho combo
    const opportunities: Opportunity[] = [];
    for (const rank of commissionRanks) {
      // find niche from CommissionRank.atSubCategoryName (map vào Niche.name fuzzy)
      const niche = await this.findNicheByCategoryName(rank.atSubCategoryName ?? rank.atCategoryName);
      if (!niche) continue;

      // Find keyword matches for this niche
      const matchedKeywords = await this.prisma.keywordNicheMatch.findMany({
        where: { nicheId: niche.id },
        include: { keyword: true },
        orderBy: { keyword: { totalOffer: "desc" } },
        take: 3
      });

      // Check if article exists for this niche × merchant
      const hasArticle = await this.prisma.article.findFirst({
        where: { nicheId: niche.id, status: "PUBLISHED" }
      });

      const productCount = await this.prisma.product.count({
        where: { nicheId: niche.id, isPublic: true }
      });

      opportunities.push({
        nicheSlug: niche.slug,
        nicheName: niche.name,
        merchant: rank.merchant,
        commissionRange: `${rank.minCommission}-${rank.maxCommission}%`,
        commissionMax: rank.maxCommission,
        hotKeywords: matchedKeywords.map(m => m.keyword.iconText),
        productCount,
        hasArticle: !!hasArticle,
        // Score: cao nếu commission cao + có keyword hot + có product + chưa có article
        score: rank.maxCommission
          + (matchedKeywords.length > 0 ? 5 : 0)
          + (productCount > 5 ? 3 : productCount * 0.5)
          - (hasArticle ? 10 : 0) // chưa có article = ưu tiên cao
      });
    }

    return opportunities.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async findNicheByCategoryName(atCategoryName: string): Promise<Niche | null> {
    if (!atCategoryName) return null;
    const lower = removeDiacritics(atCategoryName.toLowerCase());
    return this.prisma.niche.findFirst({
      where: {
        OR: [
          { name: { contains: atCategoryName, mode: "insensitive" } },
          { slug: { contains: lower.replace(/\s+/g, "-") } }
        ]
      }
    });
  }
}

interface Opportunity {
  nicheSlug: string;
  nicheName: string;
  merchant: string;
  commissionRange: string;
  commissionMax: number;
  hotKeywords: string[];
  productCount: number;
  hasArticle: boolean;
  score: number;
}
```

### AC6 — Hook vào sync orchestrator

Update STORY-02 `POST /admin/sync/all` để include 2 service mới:

```ts
for (const [name, runner] of [
  ["crawler", () => this.crawlerService.runFullCycle()],
  ["reconcile", () => this.reconciliationService.runCycle()],
  ["coupon", () => this.couponSyncService.syncFromAccesstrade()],
  ["top_products", () => this.topProductsService.snapshotToday()],
  ["commission_rank", () => this.commissionRankService.refresh()],   // NEW
  ["keyword_radar", () => this.keywordRadarService.refresh()]        // NEW
] as const) { ... }
```

Standalone manual trigger:
- `POST /admin/sync/commission_rank`
- `POST /admin/sync/keyword_radar`

### AC7 — Endpoint `GET /admin/opportunities/weekly`

```ts
@Get("opportunities/weekly")
async getWeeklyOpportunities(
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
  return this.opportunityService.getTopOpportunities(5);
}
```

Cache 1h (response header `Cache-Control`).

### AC8 — Admin widget: replace placeholder

File: `apps/web/components/admin/dashboard/commission-keyword-widget.tsx` (replace STORY-03 placeholder).

```tsx
import { adminFetch } from "../ui/admin-fetch";
import Link from "next/link";

interface Opportunity {
  nicheSlug: string;
  nicheName: string;
  merchant: string;
  commissionRange: string;
  hotKeywords: string[];
  productCount: number;
  hasArticle: boolean;
}

export async function CommissionKeywordWidget() {
  const opportunities = await adminFetch<Opportunity[]>("/admin/opportunities/weekly", "GET");

  if (opportunities.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-card p-5">
        <h3 className="text-base font-semibold text-ink">🔥 Cơ hội tuần</h3>
        <p className="mt-3 text-sm text-ink-soft">Chưa có dữ liệu. <Link href="/admin" className="text-brand-700">Click "Đồng bộ tất cả"</Link> để fetch lần đầu.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <h3 className="text-base font-semibold text-ink">🔥 Cơ hội tuần</h3>
      <p className="mt-0.5 text-xs text-ink-soft">Niche × merchant trả % cao + keyword đang hot + chưa có article</p>

      <ol className="mt-4 space-y-3">
        {opportunities.map((opp, i) => (
          <li key={`${opp.nicheSlug}-${opp.merchant}`} className="rounded-lg border border-line bg-card-soft p-3">
            <div className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {opp.nicheName} × {opp.merchant.toUpperCase()}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Commission <span className="font-medium text-emerald-700">{opp.commissionRange}</span>
                  {' • '}
                  {opp.productCount} sản phẩm sẵn
                  {!opp.hasArticle && ' • '}
                  {!opp.hasArticle && <span className="text-amber-700">chưa có article</span>}
                </p>
                {opp.hotKeywords.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {opp.hotKeywords.slice(0, 3).map(kw => (
                      <span key={kw} className="rounded-full bg-canvas px-2 py-0.5 text-[10px] text-ink-soft">
                        🔥 {kw}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <Link
                    href={`/admin/articles/new?niche=${opp.nicheSlug}&topic=${encodeURIComponent(opp.hotKeywords[0] ?? opp.nicheName)}&merchant=${opp.merchant}&commissionHint=${opp.commissionRange}`}
                    className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Tạo bài →
                  </Link>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

### AC9 — Article wizard prefill

STORY-10 (Article wizard 1-form) sẽ implement form `/admin/articles/new` mới. Story này chỉ ensure URL params được parse:
- `?niche=<slug>` → preselect niche dropdown.
- `?topic=<encoded>` → prefill topic input.
- `?merchant=<slug>` → preselect merchant filter cho productHints.
- `?commissionHint=<range>` → inject vào AI prompt như hint "ưu tiên link sản phẩm từ merchant này, commission cao".

STORY-04 chỉ build URL với params. STORY-10 handle parse.

### AC10 — Refresh button

Widget có "↻ Refresh ngay" button (small icon top-right):

```tsx
<RefreshOpportunitiesButton />
```

NEW client component:
```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

export function RefreshOpportunitiesButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const refresh = () => start(async () => {
    await fetch("/api/admin/sync/commission_rank", { method: "POST" });
    await fetch("/api/admin/sync/keyword_radar", { method: "POST" });
    router.refresh();
  });

  return (
    <button onClick={refresh} disabled={pending} className="text-xs text-ink-mute hover:text-ink-soft disabled:opacity-50">
      <RotateCw className={pending ? "size-3 animate-spin" : "size-3"} />
    </button>
  );
}
```

## Files touched

```
apps/api/prisma/schema.prisma                                   (add 3 model: CommissionRank, KeywordTrend, KeywordNicheMatch)
apps/api/prisma/migrations/<ts>_add_commission_keyword_tables/  (NEW)
apps/api/src/modules/crawler/clients/accesstrade.client.ts      (add fetchCashbackCampaigns + fetchKeywordList)
apps/api/src/modules/crawler/clients/accesstrade-dto.ts         (add DTO)
apps/api/src/modules/insights/insights.module.ts                (NEW module)
apps/api/src/modules/insights/commission-rank.service.ts        (NEW)
apps/api/src/modules/insights/keyword-radar.service.ts          (NEW)
apps/api/src/modules/insights/opportunity.service.ts            (NEW)
apps/api/src/modules/admin/admin.controller.ts                  (add sync/commission_rank + sync/keyword_radar + GET /opportunities/weekly + update sync/all)
apps/api/src/utils/diacritics.ts                                (NEW or import existing)
apps/web/components/admin/dashboard/commission-keyword-widget.tsx  (replace placeholder)
apps/web/components/admin/dashboard/refresh-opportunities-button.tsx  (NEW client)
apps/web/app/api/admin/sync/commission_rank/route.ts            (NEW proxy)
apps/web/app/api/admin/sync/keyword_radar/route.ts              (NEW proxy)
apps/web/app/api/admin/opportunities/weekly/route.ts            (NEW proxy)
```

## Verification

```bash
# 1. Migration
npm run db:migrate -- --name add_commission_keyword_tables

# 2. Sync trigger
curl -X POST http://localhost:4000/api/v1/admin/sync/commission_rank -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: {fetched: ~250, saved: 250}

curl -X POST http://localhost:4000/api/v1/admin/sync/keyword_radar -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: {fetched: ~50-200, saved, matched}

# 3. Query opportunities
curl http://localhost:4000/api/v1/admin/opportunities/weekly -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: array of 5 opportunity with niche × merchant pairs

# 4. Sync all includes 2 new
curl -X POST http://localhost:4000/api/v1/admin/sync/all -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: results includes commission_rank + keyword_radar

# 5. Admin widget render
# Open /admin → widget "🔥 Cơ hội tuần" hiển thị 5 row với data thật

# 6. Click "Tạo bài" trên row → /admin/articles/new?niche=...&topic=...&merchant=...&commissionHint=...
# expect: URL params được set

# 7. Refresh button
# Click ↻ → 2 sync chạy lại, widget re-render với data fresh
```

## Definition of done

- [ ] 3 model migrated, indexed đúng.
- [ ] 2 AccesstradeClient method work, parsed response shape.
- [ ] CommissionRankService refresh purge old batch + save new.
- [ ] KeywordRadarService refresh + niche match computation.
- [ ] OpportunityService score đúng: commission cao + product có sẵn + chưa article = top.
- [ ] Sync orchestrator extended với 2 entry mới.
- [ ] Admin widget replace placeholder với data thật.
- [ ] Click "Tạo bài" → URL params đúng cho STORY-10.
- [ ] Refresh button trigger 2 sync.
- [ ] AT rate-limit không bị (sleep 1s giữa page).

## Notes for next session

- `findNicheByCategoryName` fuzzy match heuristic ban đầu — có thể tinh chỉnh khi data thật về.
- `matchKeywordToNiche` simple word match — sau có thể dùng embedding (Gemini) nếu cần độ chính xác cao.
- Cache `getTopOpportunities` 1h vì AT data weekly, không cần real-time.
- STORY-10 sẽ parse URL params từ widget link.
- Nếu AT cashback endpoint timeout >30s, cân nhắc background job. Hiện tại synchronous OK.
- Score formula có thể A/B sau khi có data — operator có thể tweak threshold.
