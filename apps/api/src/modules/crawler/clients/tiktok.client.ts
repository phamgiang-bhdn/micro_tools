import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork } from "@prisma/client";
import { NormalizedOffer } from "../dto/normalized-offer.dto";
import { AffiliateClient } from "./affiliate-client.interface";

/**
 * STUB: TikTok Shop Affiliate API yêu cầu OAuth + signing.
 * Sau khi có APP_KEY + APP_SECRET sẽ implement đầy đủ.
 */
@Injectable()
export class TiktokAffiliateClient implements AffiliateClient {
  readonly network = AffiliateNetwork.TIKTOK;
  private readonly logger = new Logger(TiktokAffiliateClient.name);

  isConfigured(): boolean {
    return Boolean(process.env.TIKTOK_AFFILIATE_APP_KEY && process.env.TIKTOK_AFFILIATE_APP_SECRET);
  }

  async fetchProducts(): Promise<NormalizedOffer[]> {
    if (!this.isConfigured()) {
      this.logger.warn("TikTok Affiliate not configured — skipping");
      return [];
    }
    this.logger.warn("TikTok Affiliate client is a stub — TODO: implement Shop API offer query");
    return [];
  }
}
