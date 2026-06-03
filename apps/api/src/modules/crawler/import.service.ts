import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork, ParseStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../utils/slug.util";
import { ConfidenceService } from "../refinery/confidence.service";
import { NormalizedOffer } from "./dto/normalized-offer.dto";
import { networkFromSource } from "./network.util";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

/**
 * Idempotent upsert: dùng affiliateUrl làm dedup key.
 * PR4: KHÔNG còn gán Product.nicheId tự động — admin gán tay trong /admin/products.
 * Tự sinh slug từ name (unique scope toàn DB; vì nicheId nullable, slug uniqueness về URL chỉ
 * relevant sau khi admin gán niche → slug có thể bị collide nếu 2 product unassigned cùng slug,
 * nhưng KHÔNG vỡ vì storefront chỉ render product có nicheId).
 * Auto-upsert Campaign từ offer raw values. (Taxonomy Category/Source/Brand đã cắt ở Refactor V3 —
 * phân loại/nguồn/domain giờ đọc thẳng từ scrapedData khi cần, không còn bảng + FK riêng.)
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly confidence: ConfidenceService
  ) {}

  async upsertOffers(offers: NormalizedOffer[]): Promise<ImportResult> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const offer of offers) {
      if (!offer.affiliateUrl || !offer.name) {
        skipped += 1;
        continue;
      }

      // PR4: niche KHÔNG còn auto-assign. Crawler chỉ vẫn nhận offer.nicheSlug (legacy contract
      // từ CampaignNiche routing) nhưng IGNORE — Product.nicheId luôn null cho row mới.
      // Admin gán niche tay trong /admin/products sau khi review + filter theo Category/Source/Brand.

      const network = networkFromSource(offer.source);
      const campaignId = offer.campaignDbId ?? (await this.resolveCampaignId(network, offer));

      const existing = await this.prisma.product.findFirst({
        where: { affiliateUrl: offer.affiliateUrl }
      });

      const scrapedData = {
        // Identity
        sourceId: offer.externalId,
        sourceNetwork: offer.source,
        sku: offer.sku,
        sourceProductId: offer.sourceProductId,
        // Display
        image: offer.image,
        description: offer.description,
        brand: offer.brand,
        // Money
        price: offer.price,
        originalPrice: offer.originalPrice,
        salePrice: offer.salePrice,
        currency: offer.currency,
        discountPercent: offer.discountPercent,
        discountRate: offer.discountRate,
        discountAmount: offer.discountAmount,
        statusDiscount: offer.statusDiscount,
        promotion: offer.promotion,
        // Classification
        category: offer.category,
        atCategorySlug: offer.atCategorySlug,
        // Source context
        store: offer.store,
        merchant: offer.merchantName,
        campaign: offer.campaign,
        updateTime: offer.updateTime,
        // Editorial (admin/AI override)
        badge: offer.badge,
        highlights: offer.highlights,
        // Network-specific raw (full AT response cho admin debug)
        metadata: offer.metadata
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
        await this.recomputeConfidence(existing.id);
        updated += 1;
        continue;
      }

      // Slug = slugify(name). KHÔNG cần dedupe lúc import vì nicheId=null → @@unique([nicheId, slug])
      // cho phép multiple NULL (Postgres). Khi admin gán niche, /admin/products/bulk re-dedup theo niche.
      const slug = slugify(offer.name);

      const newProduct = await this.prisma.product.create({
        data: {
          nicheId: null,
          network,
          campaignId: campaignId ?? null,
          name: offer.name,
          slug,
          affiliateUrl: offer.affiliateUrl,
          scrapedData: scrapedData as Prisma.InputJsonValue,
          isPublic: false
        }
      });
      await this.recomputeConfidence(newProduct.id);
      created += 1;
    }

    return { created, updated, skipped };
  }

  /**
   * STORY-09: compute confidence score + auto-approve gate. Hook chạy sau mọi upsert
   * (cả create lẫn update). Không throw nếu fail — log warn rồi tiếp tục.
   */
  private async recomputeConfidence(productId: string): Promise<void> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { niche: true }
      });
      if (!product) return;

      const result = this.confidence.compute(product, product.niche ?? null);
      const threshold = this.confidence.getAutoApproveThreshold();
      const shouldAutoApprove = result.score >= threshold;

      // Kiểm tra extraction hiện tại — đừng override row đã review thủ công.
      const existing = await this.prisma.productExtraction.findFirst({
        where: { productId, status: { in: [ParseStatus.DRAFT_RAW, ParseStatus.PENDING_REVIEW] } },
        orderBy: { createdAt: "desc" }
      });

      if (existing) {
        await this.prisma.productExtraction.update({
          where: { id: existing.id },
          data: {
            confidenceScore: result.score,
            confidenceReasons: result.reasons as Prisma.InputJsonValue,
            ...(shouldAutoApprove && !existing.autoApproved
              ? {
                  status: ParseStatus.PUBLISHED,
                  autoApproved: true,
                  autoApprovedAt: new Date()
                }
              : {})
          }
        });
      } else {
        await this.prisma.productExtraction.create({
          data: {
            productId,
            rawContent: "",
            status: shouldAutoApprove ? ParseStatus.PUBLISHED : ParseStatus.PENDING_REVIEW,
            confidenceScore: result.score,
            confidenceReasons: result.reasons as Prisma.InputJsonValue,
            autoApproved: shouldAutoApprove,
            autoApprovedAt: shouldAutoApprove ? new Date() : null
          }
        });
      }

      if (shouldAutoApprove) {
        await this.prisma.product.update({
          where: { id: productId },
          data: { isPublic: true }
        });
      }
    } catch (err: unknown) {
      this.logger.warn(
        `[confidence] product=${productId} fail: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * @deprecated Chỉ dùng cho path không có `offer.campaignDbId` (vd web-scrape paste URL tay).
   * Crawler-cycle per-campaign (sau STORY-03) đã pre-resolve Campaign.id vào offer.campaignDbId.
   * STORY-08 sẽ cân nhắc xoá khi mọi path đã đi qua AT campaign sync.
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
