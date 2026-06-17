import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork, ParseStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../utils/slug.util";
import { ConfidenceService } from "../refinery/confidence.service";
import { ClassificationService } from "./classification.service";
import { ClassificationResult } from "./classification.types";
import { NormalizedOffer } from "./dto/normalized-offer.dto";
import { networkFromSource } from "./network.util";
import { PriceIntelligenceService, SnapshotInput } from "./price-intelligence.service";

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
    private readonly confidence: ConfidenceService,
    private readonly priceIntel: PriceIntelligenceService,
    private readonly classification: ClassificationService
  ) {}

  async upsertOffers(offers: NormalizedOffer[]): Promise<ImportResult> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // V4: load niche ACTIVE 1 lần → classify từng offer (lọc đống merchant-wide về đúng niche bật).
    const activeNiches = await this.classification.loadActiveNiches();

    for (const offer of offers) {
      if (!offer.affiliateUrl || !offer.name) {
        skipped += 1;
        continue;
      }

      // V4: phân loại offer vào niche ACTIVE. method "keyword" (deterministic) đủ tin để qua
      // auto-approve; "ai"/"ambiguous"/"none" → giữ trong HITL (không tự public). nicheId chỉ là GỢI Ý.
      const cls = await this.classification.classify(offer, activeNiches);

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
        metadata: offer.metadata,
        // V4: dấu vết phân loại (admin biết vì sao offer landed ở niche này / bị quarantine)
        classification: { method: cls.method, nicheSlug: cls.nicheSlug, score: cls.score }
      };

      if (existing) {
        // Đã có row — làm mới name/scrapedData, GIỮ slug cũ (URL không đổi → không vỡ index SEO).
        // campaignId chỉ set nếu chưa có (admin có thể đã gán tay; không ghi đè).
        // V4: backfill niche gợi ý CHỈ khi admin chưa gán tay + không gây clash slug (giữ crawl không vỡ).
        const backfillNicheId =
          existing.nicheId == null && cls.nicheId
            ? await this.resolveBackfillNiche(cls.nicheId, existing.slug, existing.id)
            : null;
        await this.prisma.product.update({
          where: { id: existing.id },
          data: {
            name: offer.name,
            scrapedData: scrapedData as Prisma.InputJsonValue,
            ...(existing.campaignId ? {} : campaignId ? { campaignId } : {}),
            ...(backfillNicheId ? { nicheId: backfillNicheId } : {})
          }
        });
        await this.recomputeConfidence(existing.id, this.allowAutoApprove(cls, existing.nicheId));
        await this.captureSnapshot(existing.id, offer);
        updated += 1;
        continue;
      }

      // V4: nếu classify gán niche → slug phải unique trong niche (@@unique([nicheId, slug])).
      // nicheId=null vẫn cho trùng (Postgres coi mỗi NULL khác nhau) → chỉ dedupe khi có niche.
      let slug = slugify(offer.name);
      if (cls.nicheId) {
        slug = await this.ensureUniqueProductSlug(cls.nicheId, slug);
      }

      const newProduct = await this.prisma.product.create({
        data: {
          // V4: nicheId là GỢI Ý từ classifier (null nếu không khớp niche ACTIVE nào → quarantine).
          nicheId: cls.nicheId,
          network,
          campaignId: campaignId ?? null,
          name: offer.name,
          slug,
          affiliateUrl: offer.affiliateUrl,
          scrapedData: scrapedData as Prisma.InputJsonValue,
          isPublic: false
        }
      });
      await this.recomputeConfidence(newProduct.id, this.allowAutoApprove(cls, null));
      await this.captureSnapshot(newProduct.id, offer);
      created += 1;
    }

    return { created, updated, skipped };
  }

  /**
   * V4: ghi PriceSnapshot + refresh Product.priceIntel sau mỗi upsert. Giá hiệu lực = salePrice ?? price.
   * Bỏ qua khi offer không có giá. KHÔNG throw (service đã nuốt lỗi nội bộ).
   */
  private async captureSnapshot(productId: string, offer: NormalizedOffer): Promise<void> {
    const price = offer.salePrice ?? offer.price;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return;
    const input: SnapshotInput = {
      price,
      originalPrice: typeof offer.originalPrice === "number" ? offer.originalPrice : null,
      currency: offer.currency ?? "VND",
      source: offer.source ?? null
    };
    await this.priceIntel.captureAndRefresh(productId, input);
  }

  /**
   * V4 HITL-safe gate: chỉ cho auto-approve khi đường phân loại đáng tin.
   * - admin đã gán niche tay → tin → luồng cũ.
   * - keyword match (deterministic) → cho auto-approve.
   * - ai / ambiguous / none → giữ PENDING_REVIEW, KHÔNG tự lên storefront.
   */
  private allowAutoApprove(cls: ClassificationResult, existingNicheId: string | null): boolean {
    return existingNicheId != null || cls.method === "keyword";
  }

  /**
   * V4: tìm slug chưa bị chiếm trong niche để né @@unique([nicheId, slug]) khi create.
   * Thử base, base-2, base-3… rồi fallback suffix ngắn nếu kẹt > 50 (gần như không xảy ra).
   */
  private async ensureUniqueProductSlug(nicheId: string, base: string): Promise<string> {
    const root = base.length > 0 ? base : "san-pham";
    let candidate = root;
    for (let i = 2; i <= 50; i += 1) {
      const clash = await this.prisma.product.findFirst({
        where: { nicheId, slug: candidate },
        select: { id: true }
      });
      if (!clash) return candidate;
      candidate = `${root}-${i}`;
    }
    return `${root}-${Date.now().toString(36).slice(-4)}`;
  }

  /**
   * V4: chỉ backfill niche cho product cũ nếu slug hiện tại không đụng product khác trong niche đó.
   * slug null → an toàn (Postgres coi NULL khác nhau). Đụng → trả null (bỏ backfill, không vỡ crawl).
   */
  private async resolveBackfillNiche(
    nicheId: string,
    slug: string | null,
    productId: string
  ): Promise<string | null> {
    if (!slug) return nicheId;
    const clash = await this.prisma.product.findFirst({
      where: { nicheId, slug, NOT: { id: productId } },
      select: { id: true }
    });
    return clash ? null : nicheId;
  }

  /**
   * STORY-09: compute confidence score + auto-approve gate. Hook chạy sau mọi upsert
   * (cả create lẫn update). Không throw nếu fail — log warn rồi tiếp tục.
   * V4: `allowAutoApprove=false` → chỉ chấm điểm, KHÔNG flip isPublic (giữ trong HITL).
   */
  private async recomputeConfidence(productId: string, allowAutoApprove = true): Promise<void> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { niche: true }
      });
      if (!product) return;

      const result = this.confidence.compute(product, product.niche ?? null);
      const threshold = this.confidence.getAutoApproveThreshold();
      const shouldAutoApprove = allowAutoApprove && result.score >= threshold;

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
