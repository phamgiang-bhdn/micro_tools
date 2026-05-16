import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient } from "./clients/accesstrade.client";
import { AffiliateClient } from "./clients/affiliate-client.interface";
import { LazadaAffiliateClient } from "./clients/lazada.client";
import { ShopeeAffiliateClient } from "./clients/shopee.client";
import { TiktokAffiliateClient } from "./clients/tiktok.client";
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
 * Thêm network mới: implement AffiliateClient, đăng ký trong CrawlerModule, inject vào constructor dưới đây.
 */
@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly clients: AffiliateClient[];

  constructor(
    accesstrade: AccesstradeClient,
    shopee: ShopeeAffiliateClient,
    tiktok: TiktokAffiliateClient,
    lazada: LazadaAffiliateClient,
    private readonly enrichment: EnrichmentService,
    private readonly importer: ImportService,
    private readonly prisma: PrismaService
  ) {
    const all: AffiliateClient[] = [accesstrade, shopee, tiktok, lazada];
    const enabled = (process.env.CRAWLER_ENABLED_NETWORKS ?? "accesstrade")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    this.clients = all.filter((c) => enabled.includes(c.network.toLowerCase()));
    const skipped = all.filter((c) => !this.clients.includes(c)).map((c) => c.network);
    if (skipped.length > 0) {
      this.logger.log(`Crawler enabled networks: ${this.clients.map((c) => c.network).join(", ") || "(none)"}; skipped: ${skipped.join(", ")}`);
    }
  }

  async runFullCycle(triggeredBy = "cron"): Promise<CycleResult> {
    const minDiscount = Number(process.env.CRAWLER_MIN_DISCOUNT_PERCENT ?? "20");
    this.logger.log("Crawler cycle started");
    const log = await this.prisma.crawlerLog.create({ data: { triggeredBy } });
    const start = Date.now();

    try {
      const results = await Promise.all(
        this.clients.map(async (client) => {
          try {
            const offers = await client.fetchProducts({ limit: 100 });
            this.logger.log(`${client.network}: fetched ${offers.length}`);
            return offers;
          } catch (error: unknown) {
            this.logger.error(
              `${client.network} fetch failed`,
              error instanceof Error ? error.message : String(error)
            );
            return [];
          }
        })
      );
      const all = results.flat();
      const fetched = all.length;

      const passed: NormalizedOffer[] = all.filter((o) => (o.discountPercent ?? 0) >= minDiscount);
      this.logger.log(`Fetched ${fetched}, passed filter ${passed.length} (≥${minDiscount}%)`);

      const enriched: NormalizedOffer[] = [];
      for (const offer of passed) {
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
          fetched,
          passedFilter: passed.length,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          success: true,
          durationMs: Date.now() - start
        }
      });

      return { fetched, passedFilter: passed.length, ...result };
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
}
