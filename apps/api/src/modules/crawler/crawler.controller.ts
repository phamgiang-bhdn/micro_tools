import { Body, Controller, Get, Headers, HttpException, HttpStatus, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { CrawlerService } from "./crawler.service";
import { WebScrapeClient } from "./clients/web-scrape.client";
import { EnrichmentService } from "./enrichment.service";
import { ImportService } from "./import.service";

const ingestSchema = z.object({
  url: z.string().url(),
  nicheSlug: z.string().min(1),
  affiliateUrl: z.string().url().optional()
});

const runSelectedSchema = z.object({
  campaignIds: z.array(z.string().uuid()).min(1).max(50),
  overrideLimit: z.number().int().min(1).max(500).optional()
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

  /** Poll progress cycle đang/vừa chạy. Trả in-memory snapshot. */
  @Get("progress")
  async getProgress(@Headers("x-admin-key") apiKey?: string) {
    authorize(apiKey);
    return this.crawler.getProgress();
  }

  /**
   * @deprecated Dùng `POST /admin/crawler/run-selected` (truyền campaignIds + overrideLimit).
   * Giữ tạm để không phá API cũ; sẽ xoá ở sprint sau.
   */
  @Post("run-campaign/:atCampaignId")
  async runSingleCampaign(
    @Param("atCampaignId") atCampaignId: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    authorize(apiKey);
    return this.crawler.runFullCycle(`manual-single:${atCampaignId}`);
  }

  /**
   * Chạy crawl đúng các campaign admin chọn (kèm option override limit per-campaign).
   * Khác `POST /run`: không bị giới hạn `status=APPROVED`, admin có thể test PAUSED/APPLIED.
   */
  @Post("run-selected")
  async runSelected(@Body() body: unknown, @Headers("x-admin-key") apiKey?: string) {
    authorize(apiKey);
    const parsed = runSelectedSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const { campaignIds, overrideLimit } = parsed.data;
    return this.crawler.runFullCycle(`manual-selected:${campaignIds.length}`, {
      campaignIds,
      overrideLimit
    });
  }

  /** Paste URL bất kỳ → AI bóc dữ liệu → upsert vào DB. */
  @Post("ingest")
  async ingestUrl(@Body() body: unknown, @Headers("x-admin-key") apiKey?: string) {
    authorize(apiKey);
    const parsed = ingestSchema.parse(body);
    const offer = await this.webScrape.fetchByUrl(parsed.url, parsed.nicheSlug, parsed.affiliateUrl);
    if (!offer) {
      throw new HttpException("Could not extract product from URL", HttpStatus.BAD_REQUEST);
    }
    const enriched = await this.enrichment.enrich(offer);
    const result = await this.importer.upsertOffers([enriched]);
    return { offer: enriched, result };
  }
}
