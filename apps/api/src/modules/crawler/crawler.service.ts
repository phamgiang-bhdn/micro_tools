import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient } from "./clients/accesstrade.client";
import { LazadaAffiliateClient } from "./clients/lazada.client";
import { ShopeeAffiliateClient } from "./clients/shopee.client";
import { TiktokAffiliateClient } from "./clients/tiktok.client";
import { DEFAULT_FILTER_RULES, FilterRules, filterRulesSchema } from "./dto/filter-rules.dto";
import { NormalizedOffer } from "./dto/normalized-offer.dto";
import { EnrichmentService } from "./enrichment.service";
import { ImportResult, ImportService } from "./import.service";

export interface CycleResult extends ImportResult {
  fetched: number;
  passedFilter: number;
}

interface AssignmentTask {
  id: string;
  priority: number;
  filterRules: Prisma.JsonValue;
  category: { id: string; slug: string };
}

interface CampaignTask {
  id: string;
  atCampaignId: string;
  name: string;
  merchantName: string | null;
  assignments: AssignmentTask[];
}

const PER_CAMPAIGN_LIMIT = 100;

/**
 * Orchestrator (per-campaign mode, sau campaign↔category N:N refactor):
 * - Lấy danh sách Campaign approved + có ≥1 assignment, gọi `/v1/datafeeds?campaign=<atCampaignId>` 1 lần / campaign.
 * - Mỗi campaign có nhiều CampaignCategory (sort priority asc). Mỗi offer được route bằng first-match-wins:
 *   loop qua assignments → đầu tiên pass filterRules → Product gắn vào Category của assignment đó.
 *   Offer không match assignment nào → skip.
 *
 * Multi-network skeleton (shopee/tiktok/lazada) vẫn được inject — sprint hiện chỉ Accesstrade active.
 * `category-inference.util.ts` (@deprecated): crawler-cycle KHÔNG infer category từ free-text nữa.
 */
@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly accesstradeEnabled: boolean;

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
    this.logger.log("Crawler cycle started (per-campaign N:N mode)");
    const log = await this.prisma.crawlerLog.create({ data: { triggeredBy } });
    const start = Date.now();

    try {
      const campaigns = this.accesstradeEnabled ? await this.loadCampaigns() : [];
      if (campaigns.length === 0) {
        this.logger.warn(
          "No eligible campaigns (need status=APPROVED + atCampaignId + ≥1 assignment). Cycle is a no-op."
        );
      }

      const perCampaign = await Promise.all(campaigns.map((c) => this.runForCampaign(c)));
      const totalFetched = perCampaign.reduce((sum, r) => sum + r.fetched, 0);
      const allOffers = perCampaign.flatMap((r) => r.offers);

      const enriched: NormalizedOffer[] = [];
      for (const offer of allOffers) {
        enriched.push(await this.enrichment.enrich(offer));
      }

      const result = await this.importer.upsertOffers(enriched);
      this.logger.log(
        `Import: +${result.created} created, ~${result.updated} updated, /${result.skipped} skipped`
      );

      await this.prisma.crawlerLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          fetched: totalFetched,
          passedFilter: allOffers.length,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          success: true,
          durationMs: Date.now() - start
        }
      });

      return { fetched: totalFetched, passedFilter: allOffers.length, ...result };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
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

  private async loadCampaigns(): Promise<CampaignTask[]> {
    const rows = await this.prisma.campaign.findMany({
      where: {
        status: "APPROVED",
        atCampaignId: { not: null },
        assignments: { some: {} }
      },
      select: {
        id: true,
        atCampaignId: true,
        merchantName: true,
        name: true,
        assignments: {
          select: {
            id: true,
            priority: true,
            filterRules: true,
            category: { select: { id: true, slug: true } }
          },
          orderBy: { priority: "asc" }
        }
      }
    });
    return rows
      .filter((r): r is typeof r & { atCampaignId: string } => Boolean(r.atCampaignId))
      .map((r) => ({
        id: r.id,
        atCampaignId: r.atCampaignId,
        name: r.name,
        merchantName: r.merchantName,
        assignments: r.assignments.map((a) => ({
          id: a.id,
          priority: a.priority,
          filterRules: a.filterRules,
          category: a.category
        }))
      }));
  }

  private async runForCampaign(
    campaign: CampaignTask
  ): Promise<{ fetched: number; offers: NormalizedOffer[] }> {
    try {
      // Fetch 1 lần / campaign với param ÍT NHẤT có thể (chỉ campaign, không truyền filter
      // discount/price ở server side nữa vì mỗi assignment có rule khác nhau — filter client-side).
      const offers = await this.accesstrade.fetchProducts({
        campaign: campaign.atCampaignId,
        limit: PER_CAMPAIGN_LIMIT
      });

      // Parse rules cho mỗi assignment 1 lần.
      const parsedAssignments = campaign.assignments.map((a) => ({
        ...a,
        rules: this.parseFilterRules(a.filterRules, campaign.name, a.id)
      }));

      // First-match-wins routing.
      const routed: NormalizedOffer[] = [];
      for (const offer of offers) {
        const matched = parsedAssignments.find((a) => offerPassesFilter(offer, a.rules));
        if (!matched) continue;
        routed.push({
          ...offer,
          categorySlug: matched.category.slug,
          campaignDbId: campaign.id
        });
      }

      this.logger.log(
        `Campaign ${campaign.name} (${campaign.atCampaignId}): fetched ${offers.length}, routed ${routed.length} across ${campaign.assignments.length} assignment(s)`
      );
      return { fetched: offers.length, offers: routed };
    } catch (error: unknown) {
      this.logger.error(
        `Campaign ${campaign.atCampaignId} failed`,
        error instanceof Error ? error.stack : String(error)
      );
      return { fetched: 0, offers: [] };
    }
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
 * Pure helper: kiểm tra 1 offer có pass filterRules không.
 * Logic:
 *  - discount: nếu offer có discountPercent → kiểm tra min/max. Nếu offer không có discountPercent
 *    nhưng rule có minDiscountPercent > 0 → fail.
 *  - price: kiểm tra min/max.
 *  - domains: nếu rule.domains có entries → affiliate URL hostname phải chứa ≥ 1 trong domain whitelist.
 *  - status_discount: chỉ filter ở fetch param (đã không truyền vì shared offer set), bỏ qua ở client side.
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
