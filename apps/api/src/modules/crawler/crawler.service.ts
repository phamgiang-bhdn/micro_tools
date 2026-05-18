import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient, FetchProductsOpts } from "./clients/accesstrade.client";
import { LazadaAffiliateClient } from "./clients/lazada.client";
import { ShopeeAffiliateClient } from "./clients/shopee.client";
import { TiktokAffiliateClient } from "./clients/tiktok.client";
import { DEFAULT_FILTER_RULES, FilterRules, filterRulesSchema } from "./dto/filter-rules.dto";
import { NormalizedOffer } from "./dto/normalized-offer.dto";
import { EnrichmentService } from "./enrichment.service";
import { ImportResult, ImportService } from "./import.service";

export interface AssignmentBreakdown {
  assignmentId: string;
  campaignId: string;
  campaignName: string;
  merchantSlug: string;
  nicheSlug: string;
  fetched: number;
  routed: number;
  failedFilter: number;
}

export interface CycleResult extends ImportResult {
  fetched: number;
  passedFilter: number;
  assignments: AssignmentBreakdown[];
}

interface AssignmentTask {
  id: string;
  priority: number;
  filterRules: Prisma.JsonValue;
  niche: { id: string; slug: string };
  campaign: {
    id: string;
    name: string;
    merchantSlug: string;
  };
}

const PER_ASSIGNMENT_LIMIT = 100;
const SLEEP_BETWEEN_FETCH_MS = 500;

/**
 * Orchestrator (per-assignment fetch — push filterRules xuống AT để pre-filter server-side):
 *
 * 1. Lấy tất cả `CampaignNiche` (assignment) của Campaign APPROVED + có atCampaignId + merchantName.
 * 2. Mỗi assignment = 1 fetch `/v1/datafeeds?campaign=<merchantSlug>` + push filterRules đã convert
 *    sang AT param (`discount_rate_from/to`, `price_from/to`, `discount_from/to`, `discount_amount_from/to`,
 *    `status_discount`, `update_from`, `domain` nếu rule chỉ có 1 domain).
 * 3. Mỗi offer fetched → route thẳng vào `assignment.niche.slug` (KHÔNG cần name match, KHÔNG cần
 *    first-match-wins — vì AT đã filter đúng cho assignment này).
 * 4. Sleep `SLEEP_BETWEEN_FETCH_MS` giữa các fetch để né rate-limit.
 * 5. Trả về `CycleResult.assignments[]` để UI hiển thị breakdown chi tiết per-assignment.
 *
 * Limit `PER_ASSIGNMENT_LIMIT = 100` (1 page, không paginate). Đủ cho test + early adopter; scale lên sau.
 *
 * Multi-network skeleton (shopee/tiktok/lazada) vẫn được inject — sprint hiện chỉ Accesstrade active.
 * `niche-inference.util.ts` (@deprecated): crawler-cycle KHÔNG infer niche từ free-text nữa.
 */
export interface CrawlerProgress {
  isRunning: boolean;
  total: number;
  done: number;
  currentLabel: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  lastError: string | null;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly accesstradeEnabled: boolean;
  // In-memory progress state (singleton service). Đủ tốt cho single-instance dev/prod.
  // Khi scale multi-instance → cần Redis/DB-backed.
  private progress: CrawlerProgress = {
    isRunning: false,
    total: 0,
    done: 0,
    currentLabel: null,
    startedAt: null,
    finishedAt: null,
    lastError: null
  };

  getProgress(): CrawlerProgress {
    return { ...this.progress };
  }

  constructor(
    private readonly accesstrade: AccesstradeClient,
    _shopee: ShopeeAffiliateClient,
    _tiktok: TiktokAffiliateClient,
    _lazada: LazadaAffiliateClient,
    private readonly enrichment: EnrichmentService,
    private readonly importer: ImportService,
    private readonly prisma: PrismaService
  ) {
    const enabled = (process.env.CRAWLER_ENABLED_NETWORKS ?? "accesstrade")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    this.accesstradeEnabled = enabled.includes("accesstrade");
    if (!this.accesstradeEnabled) {
      this.logger.warn("CRAWLER_ENABLED_NETWORKS does not include 'accesstrade' — cycle will be a no-op");
    }
  }

  async runFullCycle(triggeredBy = "cron"): Promise<CycleResult> {
    this.logger.log("Crawler cycle started (per-assignment mode)");
    const log = await this.prisma.crawlerLog.create({ data: { triggeredBy } });
    const start = Date.now();
    this.progress = {
      isRunning: true,
      total: 0,
      done: 0,
      currentLabel: "Đang tải danh sách assignment…",
      startedAt: start,
      finishedAt: null,
      lastError: null
    };

    try {
      const assignments = this.accesstradeEnabled ? await this.loadAssignments() : [];
      this.progress.total = assignments.length;
      if (assignments.length === 0) {
        this.progress.currentLabel = "Không có assignment nào eligible";
        this.logger.warn(
          "No eligible assignments (need Campaign APPROVED + atCampaignId + merchantName + ≥1 CampaignNiche). Cycle is a no-op."
        );
      }

      const breakdowns: AssignmentBreakdown[] = [];
      const allOffers: NormalizedOffer[] = [];

      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];
        this.progress.currentLabel = `${a.campaign.merchantSlug} / ${a.niche.slug}`;
        const result = await this.runForAssignment(a);
        breakdowns.push(result.breakdown);
        allOffers.push(...result.offers);
        this.progress.done = i + 1;
        if (i < assignments.length - 1) {
          await new Promise((r) => setTimeout(r, SLEEP_BETWEEN_FETCH_MS));
        }
      }

      const totalFetched = breakdowns.reduce((s, b) => s + b.fetched, 0);

      this.progress.currentLabel = `Đang AI enrich ${allOffers.length} offer…`;
      const enriched: NormalizedOffer[] = [];
      for (const offer of allOffers) {
        enriched.push(await this.enrichment.enrich(offer));
      }

      this.progress.currentLabel = `Đang upsert ${enriched.length} offer vào DB…`;
      const importResult = await this.importer.upsertOffers(enriched);
      this.logger.log(
        `Import: +${importResult.created} created, ~${importResult.updated} updated, /${importResult.skipped} skipped`
      );

      await this.prisma.crawlerLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          fetched: totalFetched,
          passedFilter: allOffers.length,
          created: importResult.created,
          updated: importResult.updated,
          skipped: importResult.skipped,
          success: true,
          durationMs: Date.now() - start
        }
      });

      this.progress.isRunning = false;
      this.progress.finishedAt = Date.now();
      this.progress.currentLabel = `Xong. +${importResult.created} mới, ~${importResult.updated} update`;

      return {
        fetched: totalFetched,
        passedFilter: allOffers.length,
        assignments: breakdowns,
        ...importResult
      };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.progress.isRunning = false;
      this.progress.finishedAt = Date.now();
      this.progress.lastError = reason.slice(0, 500);
      this.progress.currentLabel = `Lỗi: ${reason.slice(0, 200)}`;
      await this.prisma.crawlerLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          success: false,
          errorReason: reason.slice(0, 1000),
          durationMs: Date.now() - start
        }
      });
      throw error;
    }
  }

  private async loadAssignments(): Promise<AssignmentTask[]> {
    const rows = await this.prisma.campaignNiche.findMany({
      where: {
        campaign: {
          status: "APPROVED",
          atCampaignId: { not: null },
          merchantName: { not: null }
        }
      },
      select: {
        id: true,
        priority: true,
        filterRules: true,
        niche: { select: { id: true, slug: true } },
        campaign: { select: { id: true, name: true, merchantName: true } }
      },
      orderBy: [{ campaignId: "asc" }, { priority: "asc" }]
    });

    return rows
      .filter((r): r is typeof r & { campaign: typeof r.campaign & { merchantName: string } } =>
        Boolean(r.campaign.merchantName)
      )
      .map((r) => ({
        id: r.id,
        priority: r.priority,
        filterRules: r.filterRules,
        niche: r.niche,
        campaign: {
          id: r.campaign.id,
          name: r.campaign.name,
          merchantSlug: r.campaign.merchantName.trim().toLowerCase()
        }
      }));
  }

  private async runForAssignment(
    a: AssignmentTask
  ): Promise<{ breakdown: AssignmentBreakdown; offers: NormalizedOffer[] }> {
    const rules = this.parseFilterRules(a.filterRules, a.campaign.name, a.id);
    const fetchOpts: FetchProductsOpts = {
      campaign: a.campaign.merchantSlug,
      limit: PER_ASSIGNMENT_LIMIT,
      page: 1,
      ...rulesToFetchOpts(rules)
    };

    let batch: NormalizedOffer[] = [];
    try {
      batch = await this.accesstrade.fetchProducts(fetchOpts);
    } catch (error: unknown) {
      this.logger.error(
        `Assignment ${a.id} (${a.campaign.name} → ${a.niche.slug}) fetch failed`,
        error instanceof Error ? error.stack : String(error)
      );
    }

    let failedFilter = 0;
    const routed: NormalizedOffer[] = [];
    for (const offer of batch) {
      if (!offerPassesFilter(offer, rules)) {
        failedFilter += 1;
        continue;
      }
      routed.push({
        ...offer,
        nicheSlug: a.niche.slug,
        campaignDbId: a.campaign.id
      });
    }

    const breakdown: AssignmentBreakdown = {
      assignmentId: a.id,
      campaignId: a.campaign.id,
      campaignName: a.campaign.name,
      merchantSlug: a.campaign.merchantSlug,
      nicheSlug: a.niche.slug,
      fetched: batch.length,
      routed: routed.length,
      failedFilter
    };

    this.logger.log(
      `Assignment ${a.campaign.merchantSlug}/${a.niche.slug}: fetched ${batch.length}, routed ${routed.length}, ${failedFilter} failed-client-filter`
    );
    if (batch.length === 0) {
      this.logger.warn(
        `Assignment ${a.campaign.merchantSlug}/${a.niche.slug}: AT trả 0 offer với filter ${JSON.stringify(fetchOpts)}. Có thể filterRules quá khắt hoặc merchantName sai slug.`
      );
    }

    return { breakdown, offers: routed };
  }

  private parseFilterRules(
    raw: Prisma.JsonValue,
    campaignName: string,
    assignmentId: string
  ): FilterRules {
    if (raw === null || raw === undefined) {
      return DEFAULT_FILTER_RULES;
    }
    const parsed = filterRulesSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(
        `Campaign ${campaignName} assignment ${assignmentId} has invalid filterRules — fallback DEFAULT_FILTER_RULES`
      );
      return DEFAULT_FILTER_RULES;
    }
    return parsed.data;
  }
}

/**
 * Convert FilterRules → AT FetchProductsOpts. Bỏ qua field không có dữ liệu.
 * Quy ước:
 * - `domains` chỉ push `domain` xuống AT nếu rule có **đúng 1** domain (AT chỉ nhận 1/request).
 *   Nhiều domain → giữ filter client-side qua `offerPassesFilter`.
 * - `minDiscountPercent > 0` tự động kéo theo `status_discount = 1` (tránh AT trả offer không có discount).
 * - `updateLookbackDays` convert sang `update_from = DD-MM-YYYY` (format AT, gotcha #9).
 */
export function rulesToFetchOpts(rules: FilterRules): Partial<FetchProductsOpts> {
  const out: Partial<FetchProductsOpts> = {};

  if (typeof rules.minDiscountPercent === "number" && rules.minDiscountPercent > 0) {
    out.discountRateFrom = rules.minDiscountPercent;
    out.statusDiscount = 1;
  }
  if (typeof rules.maxDiscountPercent === "number") {
    out.discountRateTo = rules.maxDiscountPercent;
  }
  if (typeof rules.priceMin === "number") out.priceFrom = rules.priceMin;
  if (typeof rules.priceMax === "number") out.priceTo = rules.priceMax;
  if (typeof rules.salePriceMin === "number") out.salePriceFrom = rules.salePriceMin;
  if (typeof rules.salePriceMax === "number") out.salePriceTo = rules.salePriceMax;
  if (typeof rules.discountAmountMin === "number") out.discountAmountFrom = rules.discountAmountMin;
  if (typeof rules.discountAmountMax === "number") out.discountAmountTo = rules.discountAmountMax;

  // Explicit status_discount override (vd rule muốn `status_discount=0` để pull non-discount).
  if (rules.status_discount === 0 || rules.status_discount === 1) {
    out.statusDiscount = rules.status_discount;
  }

  if (rules.domains && rules.domains.length === 1) {
    out.domain = rules.domains[0];
  }

  if (typeof rules.updateLookbackDays === "number" && rules.updateLookbackDays > 0) {
    const from = new Date();
    from.setDate(from.getDate() - rules.updateLookbackDays);
    out.updateFrom = toAtDayFormat(from);
  }

  return out;
}

function toAtDayFormat(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Pure helper: kiểm tra 1 offer có pass filterRules không (chạy client-side sau khi AT đã filter
 * server-side). Hầu hết rule giờ đã push xuống AT, hàm này là an toàn 2 lớp + filter những cái AT
 * không support (vd `domains` whitelist > 1 entry).
 */
export function offerPassesFilter(offer: NormalizedOffer, rules: FilterRules): boolean {
  if (rules.domains && rules.domains.length > 0) {
    if (!matchesDomain(offer.affiliateUrl, rules.domains)) return false;
  }
  if (typeof rules.minDiscountPercent === "number" && rules.minDiscountPercent > 0) {
    if (typeof offer.discountPercent !== "number") return false;
    if (offer.discountPercent < rules.minDiscountPercent) return false;
  }
  if (typeof rules.maxDiscountPercent === "number") {
    if (typeof offer.discountPercent === "number" && offer.discountPercent > rules.maxDiscountPercent) {
      return false;
    }
  }
  if (typeof rules.priceMin === "number" && typeof offer.price === "number") {
    if (offer.price < rules.priceMin) return false;
  }
  if (typeof rules.priceMax === "number" && typeof offer.price === "number") {
    if (offer.price > rules.priceMax) return false;
  }
  return true;
}

function matchesDomain(affiliateUrl: string, domains: string[]): boolean {
  if (!affiliateUrl) return false;
  try {
    const host = new URL(affiliateUrl).hostname;
    return domains.some((d) => host.includes(d));
  } catch {
    return false;
  }
}
