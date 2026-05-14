import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import { NormalizedOffer } from "../dto/normalized-offer.dto";

/**
 * STUB: Shopee Affiliate Open API yêu cầu signing HMAC-SHA256 và query GraphQL.
 * Sau khi user cấp APP_ID + APP_SECRET tôi sẽ implement đầy đủ.
 * Skeleton dưới đây có sẵn helper `sign()` đúng spec.
 */
@Injectable()
export class ShopeeAffiliateClient {
  private readonly logger = new Logger(ShopeeAffiliateClient.name);

  isConfigured(): boolean {
    return Boolean(process.env.SHOPEE_AFFILIATE_APP_ID && process.env.SHOPEE_AFFILIATE_APP_SECRET);
  }

  async fetchProducts(): Promise<NormalizedOffer[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Shopee Affiliate not configured — skipping");
      return [];
    }
    this.logger.warn("Shopee Affiliate client is a stub — TODO: implement Open API offer query");
    return [];
  }

  /** Reference signing helper for the Open Affiliate API. */
  protected sign(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }
}
