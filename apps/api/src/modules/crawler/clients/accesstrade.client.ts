import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork } from "@prisma/client";
import { NormalizedOffer } from "../dto/normalized-offer.dto";
import { AffiliateClient } from "./affiliate-client.interface";

/**
 * Shape mong đợi của response từ Accesstrade Datafeed API.
 * Theo doc AT (xem docs/integrations/accesstrade.md mục 3.1):
 *  - `discount` = giá sau giảm (VND), KHÔNG phải %.
 *  - `discount_rate` = % giảm (số đáng tin để map `discountPercent`).
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
  discount_rate?: number;
  discount_amount?: number;
  status_discount?: 0 | 1;
  update_time?: string;
  promotion?: string | null;
  sku?: string;
  product_id?: string;
  cate?: string;
  category?: string;
  brand?: string;
  /** Domain của sàn/shop nơi sản phẩm được bán (vd "shopee.vn", "lazada.vn"). */
  domain?: string;
  merchant?: string;
  campaign?: string;
  desc?: string;
}

export interface FetchProductsOpts {
  page?: number;
  limit?: number;
  campaign?: string;
  domain?: string;
  /** AT `price_from/to` — giá gốc (VND). */
  priceFrom?: number;
  priceTo?: number;
  /** AT `discount_from/to` — giá sau giảm (VND). */
  salePriceFrom?: number;
  salePriceTo?: number;
  /** AT `discount_amount_from/to` — số tiền giảm tuyệt đối (VND). */
  discountAmountFrom?: number;
  discountAmountTo?: number;
  /** AT `discount_rate_from/to` — % giảm. */
  discountRateFrom?: number;
  discountRateTo?: number;
  statusDiscount?: 0 | 1;
  /** AT `update_from/to` — format DD-MM-YYYY. */
  updateFrom?: string;
  updateTo?: string;
}

interface ListResponse {
  data: AccesstradeProduct[];
  pagination?: { total: number; page: number };
}

export interface AccesstradeCampaign {
  id: string;
  name: string;
  merchant: string;
  approval: "unregistered" | "pending" | "successful";
  status: number;
  logo?: string;
  url?: string;
  scope?: "public" | "private";
  cookie_duration?: number;
  cookie_policy?: string;
  category?: string;
  sub_category?: string;
  type?: number;
  start_time?: string;
  end_time?: string | null;
  description?: {
    action_point?: string;
    commission_policy?: string;
    cookie_policy?: string;
    introduction?: string;
    other_notice?: string;
    rejected_reason?: string;
    traffic_building_policy?: string;
  };
}

interface CampaignListResponse {
  data: AccesstradeCampaign[];
  total?: number;
}

export interface AccesstradeOrder {
  order_id: string;
  merchant: string;
  billing: number;
  pub_commission: number;
  products_count: number;
  order_approved: number;
  order_pending: number;
  order_reject: number;
  is_confirmed: 0 | 1;
  sales_time: string;
  click_time: string;
  confirmed_time: string | null;
  update_time: string;
  at_product_link: string;
  landing_page: string | null;
  website: string | null;
  client_platform: string;
  browser: string;
  category_name: string | null;
  product_category: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

interface OrderListResponse {
  data: AccesstradeOrder[];
  total?: number;
}

export interface FetchOrdersOpts {
  since: Date;
  until: Date;
  page?: number;
  limit?: number;
  merchant?: string;
  status?: 0 | 1 | 2;
}

export interface AtMerchant {
  id: string;
  display_name: string;
  login_name: string;
  logo: string;
  total_offer: number;
}

export interface AtKeyword {
  id: string;
  icon_text: string;
  total_offer: number;
}

export interface AtCouponBanner {
  link: string;
  width: number;
  height: number;
}

export interface AtTopProduct {
  product_id: string;
  name: string;
  brand?: string;
  image?: string;
  link: string;
  aff_link: string;
  category_id?: string;
  category_name?: string;
  product_category?: string;
  price?: number;
  discount?: number;
  merchant?: string;
  short_desc?: string;
  desc?: string;
}

export interface FetchTopProductsOpts {
  dateFrom?: Date;
  dateTo?: Date;
  merchant?: string;
}

export interface AtCoupon {
  id: string;
  name: string;
  content: string;
  image: string;
  link: string;
  prod_link?: string;
  merchant: string;
  domain: string;
  categories?: unknown;
  start_time?: string | null;
  end_time?: string | null;
  banners?: AtCouponBanner[];
  coupons?: unknown[];
  coin_cap?: number;
  coin_percentage?: number;
  percentage_used?: number;
  discount_value?: number;
  discount_percentage?: number;
}

@Injectable()
export class AccesstradeClient implements AffiliateClient {
  readonly network = AffiliateNetwork.ACCESSTRADE;
  private readonly logger = new Logger(AccesstradeClient.name);

  isConfigured(): boolean {
    return Boolean(process.env.ACCESSTRADE_ACCESS_TOKEN);
  }

  /**
   * Trung tâm gọi AT API. Khi `ACCESSTRADE_LOG_VERBOSE=true` in **đúng 1 dòng curl**
   * trước mỗi call để paste Postman/terminal replay. Off thì im hoàn toàn.
   *
   * **CẢNH BÁO**: verbose mode in token raw — chỉ dùng dev local, KHÔNG bật prod.
   */
  private async atFetch(
    path: string,
    params: URLSearchParams
  ): Promise<{ ok: boolean; status: number; body: string }> {
    const base = "https://api.accesstrade.vn/v1";
    const token = process.env.ACCESSTRADE_ACCESS_TOKEN as string;
    const qs = params.toString();
    const url = qs ? `${base}${path}?${qs}` : `${base}${path}`;

    try {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json"
        }
      });
      const body = await resp.text();
      return { ok: resp.ok, status: resp.status, body };
    } catch (error: unknown) {
      this.logger.error(
        `[AT] FETCH_THROW ${error instanceof Error ? error.message : String(error)}`
      );
      return { ok: false, status: 0, body: "" };
    }
  }

  async fetchProducts(opts: FetchProductsOpts = {}): Promise<NormalizedOffer[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Accesstrade not configured — skipping");
      return [];
    }
    const params = new URLSearchParams();
    params.set("page", String(opts.page ?? 1));
    params.set("limit", String(opts.limit ?? 50));
    if (opts.campaign) params.set("campaign", opts.campaign);
    if (opts.domain) params.set("domain", opts.domain);
    if (opts.priceFrom !== undefined) params.set("price_from", String(opts.priceFrom));
    if (opts.priceTo !== undefined) params.set("price_to", String(opts.priceTo));
    if (opts.salePriceFrom !== undefined) params.set("discount_from", String(opts.salePriceFrom));
    if (opts.salePriceTo !== undefined) params.set("discount_to", String(opts.salePriceTo));
    if (opts.discountAmountFrom !== undefined) params.set("discount_amount_from", String(opts.discountAmountFrom));
    if (opts.discountAmountTo !== undefined) params.set("discount_amount_to", String(opts.discountAmountTo));
    if (opts.discountRateFrom !== undefined) params.set("discount_rate_from", String(opts.discountRateFrom));
    if (opts.discountRateTo !== undefined) params.set("discount_rate_to", String(opts.discountRateTo));
    if (opts.statusDiscount !== undefined) params.set("status_discount", String(opts.statusDiscount));
    if (opts.updateFrom) params.set("update_from", opts.updateFrom);
    if (opts.updateTo) params.set("update_to", opts.updateTo);

    const { ok, body } = await this.atFetch("/datafeeds", params);
    if (!ok) return [];
    try {
      const json = JSON.parse(body) as ListResponse;
      const items = Array.isArray(json.data) ? json.data : [];
      return items.map((p) => this.toNormalized(p));
    } catch {
      return [];
    }
  }

  async fetchCampaigns(
    opts: {
      approval?: "successful" | "pending" | "unregistered";
      page?: number;
      limit?: number;
    } = {}
  ): Promise<AccesstradeCampaign[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Accesstrade not configured — skipping campaigns fetch");
      return [];
    }
    const params = new URLSearchParams();
    if (opts.approval) params.set("approval", opts.approval);
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));

    const { ok, body } = await this.atFetch("/campaigns", params);
    if (!ok) return [];
    try {
      const json = JSON.parse(body) as CampaignListResponse;
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  }

  async fetchOrders(opts: FetchOrdersOpts): Promise<AccesstradeOrder[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Accesstrade not configured — skipping orders fetch");
      return [];
    }
    const params = new URLSearchParams();
    params.set("since", opts.since.toISOString());
    params.set("until", opts.until.toISOString());
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(Math.min(opts.limit, 300)));
    if (opts.merchant) params.set("merchant", opts.merchant);
    if (opts.status !== undefined) params.set("status", String(opts.status));

    const { ok, body } = await this.atFetch("/order-list", params);
    if (!ok) return [];
    try {
      const json = JSON.parse(body) as OrderListResponse;
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  }

  async fetchTopProducts(opts: FetchTopProductsOpts = {}): Promise<AtTopProduct[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Accesstrade not configured — skipping top_products");
      return [];
    }
    const params = new URLSearchParams();
    // AT /top_products dùng DD-MM-YYYY (gotcha #9), KHÔNG phải ISO.
    if (opts.dateFrom) params.set("date_from", AccesstradeClient.toAtDayFormat(opts.dateFrom));
    if (opts.dateTo) params.set("date_to", AccesstradeClient.toAtDayFormat(opts.dateTo));
    if (opts.merchant) params.set("merchant", opts.merchant);

    const { ok, body } = await this.atFetch("/top_products", params);
    if (!ok) return [];
    try {
      const json = JSON.parse(body) as { data?: AtTopProduct[]; total?: number };
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  }

  static toAtDayFormat(d: Date): string {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  async fetchMerchantsWithCoupons(): Promise<AtMerchant[]> {
    const data = await this.fetchOffersInformations<AtMerchant[]>(
      "/offers_informations/merchant_list"
    );
    return data ?? [];
  }

  async fetchKeywordsByMerchant(merchantId: string): Promise<AtKeyword[]> {
    const data = await this.fetchOffersInformations<AtKeyword[]>(
      `/offers_informations/icontext_list?merchant=${encodeURIComponent(merchantId)}`
    );
    return data ?? [];
  }

  async fetchCouponsByKeyword(iconTextId: string, limit = 20): Promise<AtCoupon[]> {
    const data = await this.fetchOffersInformations<AtCoupon[]>(
      `/offers_informations/coupon?icon_text=${encodeURIComponent(iconTextId)}&limit=${limit}`
    );
    return data ?? [];
  }

  private async fetchOffersInformations<T>(path: string): Promise<T | null> {
    if (!this.isConfigured()) {
      this.logger.warn(`Accesstrade not configured — skipping ${path}`);
      return null;
    }
    // `path` đã include cả query string (`/offers_informations/coupon?icon_text=…`).
    // Tách query string ra cho `atFetch` tái sử dụng pattern logging.
    const qIdx = path.indexOf("?");
    const pureP = qIdx === -1 ? path : path.slice(0, qIdx);
    const qsRaw = qIdx === -1 ? "" : path.slice(qIdx + 1);
    const params = new URLSearchParams(qsRaw);

    const { ok, body } = await this.atFetch(pureP, params);
    if (!ok) return null;
    try {
      const json = JSON.parse(body) as { data?: T };
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  private toNormalized(p: AccesstradeProduct): NormalizedOffer {
    const sale = p.sale_price ?? p.discount ?? p.price;
    const original = p.price && sale && p.price > sale ? p.price : undefined;

    let discountPercent: number | undefined;
    if (typeof p.discount_rate === "number" && p.discount_rate > 0 && p.discount_rate <= 100) {
      discountPercent = Math.round(p.discount_rate);
    } else if (sale && original && original > sale) {
      discountPercent = Math.round(((original - sale) / original) * 100);
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
      domain: p.domain,
      store: p.merchant,
      discountPercent,
      campaign: p.campaign,
      merchantName: p.merchant,
      nicheSlug: "",
      sku: p.sku,
      sourceProductId: p.product_id,
      atCategorySlug: p.cate,
      discountAmount: p.discount_amount,
      salePrice: p.sale_price,
      promotion: p.promotion ?? undefined,
      updateTime: p.update_time,
      statusDiscount: p.status_discount,
      discountRate: p.discount_rate,
      metadata: {
        // Giữ raw AT response để admin debug khi cần. Không dùng cho business logic.
        atRaw: p
      }
    };
  }
}
