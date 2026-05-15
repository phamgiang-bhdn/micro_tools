import { Body, Controller, Headers, HttpException, HttpStatus, Post } from "@nestjs/common";
import { z } from "zod";
import { CrawlerService } from "./crawler.service";
import { WebScrapeClient } from "./clients/web-scrape.client";
import { EnrichmentService } from "./enrichment.service";
import { ImportService } from "./import.service";

const ingestSchema = z.object({
  url: z.string().url(),
  categorySlug: z.string().min(1),
  affiliateUrl: z.string().url().optional()
});

function authorize(apiKey: string | undefined): void {
  const expected = process.env.ADMIN_API_KEY ?? "change-me";
  if (!apiKey || apiKey !== expected) {
    throw new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED);
  }
}

@Controller("admin/crawler")
export class CrawlerController {
  constructor(
    private readonly crawler: CrawlerService,
    private readonly webScrape: WebScrapeClient,
    private readonly enrichment: EnrichmentService,
    private readonly importer: ImportService
  ) {}

  /** Force-run một cycle ngay (không đợi cron). */
  @Post("run")
  async runNow(@Headers("x-admin-key") apiKey?: string) {
    authorize(apiKey);
    return this.crawler.runFullCycle("manual");
  }

  /** Paste URL bất kỳ → AI bóc dữ liệu → upsert vào DB. */
  @Post("ingest")
  async ingestUrl(@Body() body: unknown, @Headers("x-admin-key") apiKey?: string) {
    authorize(apiKey);
    const parsed = ingestSchema.parse(body);
    const offer = await this.webScrape.fetchByUrl(parsed.url, parsed.categorySlug, parsed.affiliateUrl);
    if (!offer) {
      throw new HttpException("Could not extract product from URL", HttpStatus.BAD_REQUEST);
    }
    const enriched = await this.enrichment.enrich(offer);
    const result = await this.importer.upsertOffers([enriched]);
    return { offer: enriched, result };
  }
}
