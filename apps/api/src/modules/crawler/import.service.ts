import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify, uniqueSlugWithin } from "../../utils/slug.util";
import { NormalizedOffer } from "./dto/normalized-offer.dto";
import { networkFromSource } from "./network.util";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

/**
 * Idempotent upsert: dùng affiliateUrl làm dedup key.
 * Tự sinh slug duy nhất trong scope của category — phục vụ SEO URL.
 * Auto-upsert Campaign (network, externalId) khi offer có offer.campaign — link Product.campaignId.
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

      const category = await this.prisma.category.findUnique({ where: { slug: offer.categorySlug } });
      if (!category) {
        this.logger.warn(`Category slug ${offer.categorySlug} not found — skip ${offer.name}`);
        skipped += 1;
        continue;
      }

      const network = networkFromSource(offer.source);
      const campaignId = await this.resolveCampaignId(network, offer);

      const existing = await this.prisma.product.findFirst({
        where: { affiliateUrl: offer.affiliateUrl }
      });

      const scrapedData = {
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
        // Đã có row — làm mới name/scrapedData, GIỮ slug cũ (URL không đổi → không vỡ index SEO).
        // campaignId chỉ set nếu chưa có (admin có thể đã gán tay; không ghi đè).
        await this.prisma.product.update({
          where: { id: existing.id },
          data: {
            name: offer.name,
            scrapedData: scrapedData as Prisma.InputJsonValue,
            ...(existing.campaignId ? {} : campaignId ? { campaignId } : {})
          }
        });
        updated += 1;
        continue;
      }

      const slug = await uniqueSlugWithin(slugify(offer.name), async (candidate) => {
        const hit = await this.prisma.product.findFirst({
          where: { categoryId: category.id, slug: candidate },
          select: { id: true }
        });
        return Boolean(hit);
      });

      await this.prisma.product.create({
        data: {
          categoryId: category.id,
          network,
          campaignId: campaignId ?? null,
          name: offer.name,
          slug,
          affiliateUrl: offer.affiliateUrl,
          scrapedData: scrapedData as Prisma.InputJsonValue
        }
      });
      created += 1;
    }

    return { created, updated, skipped };
  }

  /**
   * Upsert Campaign theo (network, externalId).
   * externalId = slugify(offer.campaign) — Accesstrade không trả id riêng cho campaign,
   * nên dùng tên slug-ified làm khoá ổn định. Campaign mới mặc định status=APPLIED;
   * admin sẽ chuyển trạng thái tay khi sync với dashboard publisher.
   */
  private async resolveCampaignId(
    network: AffiliateNetwork,
    offer: NormalizedOffer
  ): Promise<string | null> {
    if (!offer.campaign) return null;
    const externalId = slugify(offer.campaign);
    if (!externalId) return null;
    const campaign = await this.prisma.campaign.upsert({
      where: { network_externalId: { network, externalId } },
      create: {
        network,
        externalId,
        name: offer.campaign,
        merchantName: offer.merchantName ?? null
      },
      update: {
        // Tên/merchant có thể đổi theo thời gian — refresh, nhưng không động vào status/notes admin đã set.
        name: offer.campaign,
        ...(offer.merchantName ? { merchantName: offer.merchantName } : {})
      },
      select: { id: true }
    });
    return campaign.id;
  }
}
