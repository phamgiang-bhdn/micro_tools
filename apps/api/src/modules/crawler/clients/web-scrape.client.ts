import { Injectable, Logger } from "@nestjs/common";
import { AiService } from "../../../services/ai.service";
import { ScraperService } from "../../../services/scraper.service";
import { NormalizedOffer } from "../dto/normalized-offer.dto";

const EXTRACTION_SCHEMA = {
  name: "string",
  price: "number",
  originalPrice: "number",
  image: "string",
  description: "string",
  brand: "string",
  store: "string",
  category: "string"
};

interface ExtractedShape {
  name?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  description?: string;
  brand?: string;
  store?: string;
  category?: string;
}

/**
 * Fallback adapter cho khi user paste 1 URL bất kỳ vào admin:
 * Playwright lấy body text → Gemini bóc theo schema → NormalizedOffer.
 */
@Injectable()
export class WebScrapeClient {
  private readonly logger = new Logger(WebScrapeClient.name);

  constructor(private readonly scraper: ScraperService, private readonly ai: AiService) {}

  async fetchByUrl(url: string, toolSlug: string, affiliateUrl?: string): Promise<NormalizedOffer | null> {
    try {
      const raw = await this.scraper.scrapeTextContent(url);
      const parsed = await this.ai.parseBySchema<ExtractedShape>(raw, EXTRACTION_SCHEMA);
      if (!parsed.name) {
        this.logger.warn(`No product name extracted from ${url}`);
        return null;
      }
      let discountPercent: number | undefined;
      if (parsed.price && parsed.originalPrice && parsed.originalPrice > parsed.price) {
        discountPercent = Math.round(((parsed.originalPrice - parsed.price) / parsed.originalPrice) * 100);
      }
      return {
        source: "manual",
        externalId: url,
        name: parsed.name,
        affiliateUrl: affiliateUrl ?? url,
        image: parsed.image,
        price: parsed.price,
        originalPrice: parsed.originalPrice,
        currency: "VND",
        description: parsed.description,
        brand: parsed.brand,
        store: parsed.store,
        category: parsed.category,
        discountPercent,
        toolSlug
      };
    } catch (error: unknown) {
      this.logger.error(`WebScrape failed ${url}`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}
