import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ScraperService } from "../../services/scraper.service";
import { slugify, uniqueSlugWithin } from "../../utils/slug.util";
import { WebScrapeClient } from "./clients/web-scrape.client";
import { inferNetworkFromUrl } from "./network.util";

export interface DiscoverIngestInput {
  name: string;
  sourceUrl: string;
  nicheId: string;
  nicheSlug: string;
  reason?: string;
}

/**
 * Ingest a product discovered by AI during article generation.
 *
 * Flow: dedup by affiliateUrl → scrape source page → create Product + ProductExtraction(PENDING_REVIEW).
 * Returns productId on success, null if rejected/failed. Never throws (caller logs but keeps generating).
 */
@Injectable()
export class ProductDiscoveryService {
  private readonly logger = new Logger(ProductDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webScrape: WebScrapeClient,
    private readonly scraper: ScraperService
  ) {}

  async ingest(input: DiscoverIngestInput): Promise<string | null> {
    // Dedup: same affiliateUrl already imported
    const existing = await this.prisma.product.findFirst({
      where: { affiliateUrl: input.sourceUrl },
      select: { id: true }
    });
    if (existing) {
      this.logger.log(`Discovered product already in DB (by URL): ${input.name}`);
      return existing.id;
    }

    // Soft dedup: same niche + similar name
    const fuzzy = await this.prisma.product.findFirst({
      where: {
        nicheId: input.nicheId,
        name: { equals: input.name, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (fuzzy) {
      this.logger.log(`Discovered product already in DB (by name): ${input.name}`);
      return fuzzy.id;
    }

    // Scrape source page → NormalizedOffer. Both calls swallowed; ingest never throws.
    let offer: Awaited<ReturnType<typeof this.webScrape.fetchByUrl>> = null;
    try {
      offer = await this.webScrape.fetchByUrl(input.sourceUrl, input.nicheSlug);
    } catch (e) {
      this.logger.warn(`webScrape fetchByUrl threw for ${input.sourceUrl}: ${(e as Error).message}`);
    }
    let rawContent = "";
    try {
      rawContent = await this.scraper.scrapeTextContent(input.sourceUrl);
    } catch {
      // Already failed inside webScrape; rawContent stays empty
    }

    // Even if scrape partially fails, create a minimal Product so admin can fill in Refinery
    const name = offer?.name ?? input.name;
    const scrapedData: Record<string, unknown> = offer
      ? {
          sourceId: offer.externalId,
          sourceNetwork: offer.source,
          brand: offer.brand,
          store: offer.store,
          image: offer.image,
          description: offer.description,
          category: offer.category,
          price: offer.price,
          originalPrice: offer.originalPrice,
          currency: offer.currency,
          discountPercent: offer.discountPercent
        }
      : { sourceNetwork: "ai-discovery", note: input.reason };

    const slug = await uniqueSlugWithin(slugify(name), async (candidate) => {
      const hit = await this.prisma.product.findFirst({
        where: { nicheId: input.nicheId, slug: candidate },
        select: { id: true }
      });
      return Boolean(hit);
    });

    const product = await this.prisma.product.create({
      data: {
        nicheId: input.nicheId,
        network: inferNetworkFromUrl(input.sourceUrl),
        name,
        slug,
        affiliateUrl: input.sourceUrl,
        scrapedData: scrapedData as Prisma.InputJsonValue,
        isPublic: false
      }
    });

    await this.prisma.productExtraction.create({
      data: {
        productId: product.id,
        rawContent: rawContent || `[AI discovery] ${input.name} via ${input.sourceUrl}\nReason: ${input.reason ?? ""}`,
        aiOutput: scrapedData as Prisma.InputJsonValue,
        status: "PENDING_REVIEW",
        sourceUrl: input.sourceUrl
      }
    });

    this.logger.log(`Ingested discovered product ${name} (${product.id}) for review`);
    return product.id;
  }
}
