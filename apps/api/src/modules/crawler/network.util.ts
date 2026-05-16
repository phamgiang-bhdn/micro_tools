import { AffiliateNetwork } from "@prisma/client";
import { NormalizedOffer } from "./dto/normalized-offer.dto";

/**
 * Map NormalizedOffer.source → AffiliateNetwork enum.
 * "manual" và mọi giá trị không khớp fallback về ACCESSTRADE (network mặc định).
 */
export function networkFromSource(source: NormalizedOffer["source"]): AffiliateNetwork {
  switch (source) {
    case "accesstrade":
      return AffiliateNetwork.ACCESSTRADE;
    case "shopee":
      return AffiliateNetwork.SHOPEE;
    case "tiktok":
      return AffiliateNetwork.TIKTOK;
    case "lazada":
      return AffiliateNetwork.LAZADA;
    case "manual":
    default:
      return AffiliateNetwork.ACCESSTRADE;
  }
}

/**
 * Đoán network từ URL sản phẩm (dùng cho AI-discovered products chưa có network rõ ràng).
 * Không khớp → ACCESSTRADE (default).
 */
export function inferNetworkFromUrl(url: string): AffiliateNetwork {
  const lower = url.toLowerCase();
  if (lower.includes("shopee.")) return AffiliateNetwork.SHOPEE;
  if (lower.includes("tiktok.") || lower.includes("tiktokshop.")) return AffiliateNetwork.TIKTOK;
  if (lower.includes("lazada.")) return AffiliateNetwork.LAZADA;
  return AffiliateNetwork.ACCESSTRADE;
}
