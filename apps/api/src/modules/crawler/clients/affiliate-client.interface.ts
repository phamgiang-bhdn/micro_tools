import { AffiliateNetwork } from "@prisma/client";
import { NormalizedOffer } from "../dto/normalized-offer.dto";

export interface AffiliateClient {
  readonly network: AffiliateNetwork;
  isConfigured(): boolean;
  fetchProducts(params?: { page?: number; limit?: number }): Promise<NormalizedOffer[]>;
}
