import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../utils/slug.util";
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
 * Auto-upsert Campaign / Category / Source / Brand từ offer raw values.
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

      // PR4: niche KHÔNG còn auto-assign. Crawler chỉ vẫn nhận offer.nicheSlug (legacy contract
      // từ CampaignNiche routing) nhưng IGNORE — Product.nicheId luôn null cho row mới.
      // Admin gán niche tay trong /admin/products sau khi review + filter theo Category/Source/Brand.

      const network = networkFromSource(offer.source);
      const campaignId = offer.campaignDbId ?? (await this.resolveCampaignId(network, offer));
      const categoryId = await this.resolveCategoryId(offer);
      const sourceId = await this.resolveSourceId(offer.affiliateUrl);
      const brandId = await this.resolveBrandId(offer.brand);

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
        // Đã có row — làm mới name/scrapedData/categoryId/sourceId/brandId, GIỮ slug cũ (URL không đổi → không vỡ index SEO).
        // campaignId chỉ set nếu chưa có (admin có thể đã gán tay; không ghi đè).
        await this.prisma.product.update({
          where: { id: existing.id },
          data: {
            name: offer.name,
            scrapedData: scrapedData as Prisma.InputJsonValue,
            ...(categoryId ? { categoryId } : {}),
            ...(sourceId ? { sourceId } : {}),
            ...(brandId ? { brandId } : {}),
            ...(existing.campaignId ? {} : campaignId ? { campaignId } : {})
          }
        });
        updated += 1;
        continue;
      }

      // Slug = slugify(name). KHÔNG cần dedupe lúc import vì nicheId=null → @@unique([nicheId, slug])
      // cho phép multiple NULL (Postgres). Khi admin gán niche, /admin/products/bulk re-dedup theo niche.
      const slug = slugify(offer.name);

      await this.prisma.product.create({
        data: {
          nicheId: null,
          categoryId: categoryId ?? null,
          sourceId: sourceId ?? null,
          brandId: brandId ?? null,
          network,
          campaignId: campaignId ?? null,
          name: offer.name,
          slug,
          affiliateUrl: offer.affiliateUrl,
          scrapedData: scrapedData as Prisma.InputJsonValue,
          isPublic: false
        }
      });
      created += 1;
    }

    return { created, updated, skipped };
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

  /**
   * Idempotent upsert AT Category theo `slug` (normalized từ `offer.atCategorySlug`).
   * Giữ `rawValue` đầu tiên (KHÔNG ghi đè ở update — admin có thể đã đặt displayName dựa trên rawValue cũ).
   * Khi offer không có atCategorySlug → return null, Product.categoryId stays null.
   */
  private async resolveCategoryId(offer: NormalizedOffer): Promise<string | null> {
    const raw = offer.atCategorySlug?.trim();
    if (!raw) return null;
    const slug = normalizeLookupSlug(raw);
    if (!slug) return null;
    const category = await this.prisma.category.upsert({
      where: { slug },
      create: {
        slug,
        rawValue: raw,
        source: "accesstrade"
      },
      update: {},
      select: { id: true }
    });
    return category.id;
  }

  /**
   * Idempotent upsert Source theo hostname của `affiliateUrl` (vd "shopee.vn").
   * Source = "nơi bán" (sàn). KHÔNG ghi đè `displayName` ở update (admin có thể đã đặt).
   */
  private async resolveSourceId(affiliateUrl: string): Promise<string | null> {
    const domain = parseDomain(affiliateUrl);
    if (!domain) return null;
    const source = await this.prisma.source.upsert({
      where: { slug: domain },
      create: {
        slug: domain,
        rawValue: domain,
        source: "accesstrade"
      },
      update: {},
      select: { id: true }
    });
    return source.id;
  }

  /**
   * Idempotent upsert Brand theo `offer.brand` normalize.
   * AT trả brand không chuẩn ("Samsung" / "SAMSUNG" / "samsung ") → dedupe qua `slug` lowercase.
   * Empty / whitespace → return null (Product.brandId = null).
   */
  private async resolveBrandId(rawBrand?: string): Promise<string | null> {
    const trimmed = rawBrand?.trim();
    if (!trimmed) return null;
    const slug = normalizeLookupSlug(trimmed);
    if (!slug) return null;
    const brand = await this.prisma.brand.upsert({
      where: { slug },
      create: {
        slug,
        rawValue: trimmed,
        source: "accesstrade"
      },
      update: {},
      select: { id: true }
    });
    return brand.id;
  }
}

/**
 * Normalize chuỗi raw từ AT (vd "Điện tử & Điện lạnh", "Samsung Electronics") thành slug ổn định.
 * Dùng làm unique key cho Category / Brand. `rawValue` lưu nguyên bản để admin biết AT đã trả gì.
 */
function normalizeLookupSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Parse hostname từ URL, lowercase, bỏ "www.". Trả null nếu URL không parse được. */
function parseDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
