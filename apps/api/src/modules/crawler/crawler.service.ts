import { Injectable, Logger } from "@nestjs/common";
import { AccesstradeClient } from "./clients/accesstrade.client";
import { ShopeeAffiliateClient } from "./clients/shopee.client";
import { EnrichmentService } from "./enrichment.service";
import { ImportService, ImportResult } from "./import.service";
import { NormalizedOffer } from "./dto/normalized-offer.dto";

export interface CycleResult extends ImportResult {
  fetched: number;
  passedFilter: number;
}

/**
 * Orchestrator: pull → filter → enrich → upsert.
 * Mọi adapter nguồn trả về NormalizedOffer[]; service này không biết về API riêng của từng nguồn.
 */
@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly accesstrade: AccesstradeClient,
    private readonly shopee: ShopeeAffiliateClient,
    private readonly enrichment: EnrichmentService,
    private readonly importer: ImportService
  ) {}

  async runFullCycle(): Promise<CycleResult> {
    const minDiscount = Number(process.env.CRAWLER_MIN_DISCOUNT_PERCENT ?? "20");
    this.logger.log("Crawler cycle started");

    const [a, s] = await Promise.all([this.accesstrade.fetchProducts({ limit: 100 }), this.shopee.fetchProducts()]);
    const fetched = a.length + s.length;

    const passed: NormalizedOffer[] = [...a, ...s].filter((o) => (o.discountPercent ?? 0) >= minDiscount);
    this.logger.log(`Fetched ${fetched}, passed filter ${passed.length} (≥${minDiscount}%)`);

    const enriched: NormalizedOffer[] = [];
    for (const offer of passed) {
      enriched.push(await this.enrichment.enrich(offer));
    }

    const result = await this.importer.upsertOffers(enriched);
    this.logger.log(
      `Import: +${result.created} created, ~${result.updated} updated, /${result.skipped} skipped`
    );

    return { fetched, passedFilter: passed.length, ...result };
  }
}
