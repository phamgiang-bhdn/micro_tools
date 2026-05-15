import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork } from "@prisma/client";
import { NormalizedOffer } from "../dto/normalized-offer.dto";
import { AffiliateClient } from "./affiliate-client.interface";

/**
 * STUB: Lazada Affiliate (Lazada Open Platform) yêu cầu signing SHA256 + appKey/appSecret.
 * Sau khi có credentials sẽ implement đầy đủ.
 */
@Injectable()
export class LazadaAffiliateClient implements AffiliateClient {
  readonly network = AffiliateNetwork.LAZADA;
  private readonly logger = new Logger(LazadaAffiliateClient.name);

  isConfigured(): boolean {
    return Boolean(process.env.LAZADA_AFFILIATE_APP_KEY && process.env.LAZADA_AFFILIATE_APP_SECRET);
  }

  async fetchProducts(): Promise<NormalizedOffer[]> {
    if (!this.isConfigured()) {
      this.logger.warn("Lazada Affiliate not configured — skipping");
      return [];
    }
    this.logger.warn("Lazada Affiliate client is a stub — TODO: implement Open Platform query");
    return [];
  }
}
