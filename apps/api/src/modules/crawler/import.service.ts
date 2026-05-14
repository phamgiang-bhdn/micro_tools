import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify, uniqueSlugWithin } from "../../utils/slug.util";
import { NormalizedOffer } from "./dto/normalized-offer.dto";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

/**
 * Idempotent upsert: dùng affiliateUrl làm dedup key.
 * Tự sinh slug duy nhất trong scope của tool — phục vụ SEO URL.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsertOffers(offers: NormalizedOffer[]): Promise<ImportResult> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const offer of offers) {
      if (!offer.affiliateUrl || !offer.name) {
        skipped += 1;
        continue;
      }

      const tool = await this.prisma.tool.findUnique({ where: { slug: offer.toolSlug } });
      if (!tool) {
        this.logger.warn(`Tool slug ${offer.toolSlug} not found — skip ${offer.name}`);
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.product.findFirst({
        where: { affiliateUrl: offer.affiliateUrl }
      });

      const scrapedData: Record<string, unknown> = {
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
        discountPercent: offer.discountPercent,
        badge: offer.badge,
        highlights: offer.highlights,
        merchant: offer.merchantName,
        campaign: offer.campaign
      };

      if (existing) {
        // Đã có row — chỉ làm mới name + scrapedData, GIỮ slug cũ (URL không đổi → không vỡ index SEO).
        await this.prisma.product.update({
          where: { id: existing.id },
          data: { name: offer.name, scrapedData }
        });
        updated += 1;
        continue;
      }

      const slug = await uniqueSlugWithin(slugify(offer.name), async (candidate) => {
        const hit = await this.prisma.product.findFirst({
          where: { toolId: tool.id, slug: candidate },
          select: { id: true }
        });
        return Boolean(hit);
      });

      await this.prisma.product.create({
        data: {
          toolId: tool.id,
          network: offer.source.toUpperCase(),
          name: offer.name,
          slug,
          affiliateUrl: offer.affiliateUrl,
          scrapedData
        }
      });
      created += 1;
    }

    return { created, updated, skipped };
  }
}
