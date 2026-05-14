import { Injectable, Logger } from "@nestjs/common";
import { NormalizedOffer } from "../dto/normalized-offer.dto";

/**
 * Shape mong đợi của response từ Accesstrade Datafeed API.
 * Tên field theo tài liệu publisher; nếu nguồn thay đổi chỉ cần sửa ở đây.
 */
interface AccesstradeProduct {
  id: string;
  name: string;
  aff_link?: string;
  url?: string;
  image?: string;
  price?: number;
  sale_price?: number;
  discount?: number;
  category?: string;
  brand?: string;
  merchant?: string;
  campaign?: string;
  desc?: string;
}

interface ListResponse {
  data: AccesstradeProduct[];
  pagination?: { total: number; page: number };
}

const TOOL_BY_KEYWORD: Array<[RegExp, string]> = [
  [/laptop|máy tính|tablet|điện thoại|tai nghe|loa|monitor|màn hình|smart\s?tv|console|gaming|bàn phím|chuột/i, "tech-gadgets"],
  [/làm đẹp|son|kem|chống nắng|serum|skincare|mỹ phẩm|dior|chanel|sk[\s-]?ii|hasaki/i, "beauty-skincare"],
  [/du lịch|khách sạn|tour|vé|booking|agoda|traveloka|hotel|flight|chuyến bay|vinpearl/i, "travel-deals"],
  [/gia dụng|nồi|máy lọc|máy hút|robot|airpurifier|home|bếp|nồi chiên/i, "home-appliances"],
  [/thẻ|card|tín dụng|cashback|visa|mastercard|ngân hàng|amex/i, "credit-card-compare"]
];

function inferToolSlug(category?: string, name?: string): string {
  const target = `${category ?? ""} ${name ?? ""}`;
  for (const [pattern, slug] of TOOL_BY_KEYWORD) {
    if (pattern.test(target)) return slug;
  }
  return "tech-gadgets";
}

@Injectable()
export class AccesstradeClient {
  private readonly logger = new Logger(AccesstradeClient.name);

  isConfigured(): boolean {
    return Boolean(process.env.ACCESSTRADE_ACCESS_TOKEN);
  }

  async fetchProducts({ page = 1, limit = 50 }: { page?: number; limit?: number } = {}): Promise<NormalizedOffer[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Accesstrade not configured — skipping");
      return [];
    }
    const base = process.env.ACCESSTRADE_API_BASE ?? "https://api.accesstrade.vn/v1";
    const token = process.env.ACCESSTRADE_ACCESS_TOKEN as string;
    const url = `${base}/datafeeds?page=${page}&limit=${limit}`;

    try {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json"
        }
      });
      if (!resp.ok) {
        const body = await resp.text();
        this.logger.error(`Accesstrade ${resp.status}: ${body.slice(0, 300)}`);
        return [];
      }
      const json = (await resp.json()) as ListResponse;
      const items = Array.isArray(json.data) ? json.data : [];
      return items.map((p) => this.toNormalized(p));
    } catch (error: unknown) {
      this.logger.error("Accesstrade fetch failed", error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  private toNormalized(p: AccesstradeProduct): NormalizedOffer {
    const sale = p.sale_price ?? p.price;
    const original = p.sale_price && p.price && p.price > p.sale_price ? p.price : undefined;
    let discountPercent: number | undefined;
    if (sale && original && original > sale) {
      discountPercent = Math.round(((original - sale) / original) * 100);
    } else if (typeof p.discount === "number" && p.discount > 0 && p.discount <= 100) {
      discountPercent = Math.round(p.discount);
    }
    return {
      source: "accesstrade",
      externalId: p.id,
      name: p.name,
      affiliateUrl: p.aff_link ?? p.url ?? "",
      image: p.image,
      price: sale,
      originalPrice: original,
      currency: "VND",
      description: p.desc,
      category: p.category,
      brand: p.brand,
      store: p.merchant,
      discountPercent,
      campaign: p.campaign,
      merchantName: p.merchant,
      toolSlug: inferToolSlug(p.category, p.name)
    };
  }
}
