import type { ProductItem, ProductView } from "./types";
import { inferStoreTier } from "./store-tier";

const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("vi-VN");

export function formatMoney(value: number | undefined | null, currency = "VND"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (currency === "USD") return usdFormatter.format(value);
  return vndFormatter.format(value);
}

export function formatNumber(value: number | undefined | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return numberFormatter.format(value);
}

/**
 * Social proof inline: "★4.8 · 1.2k đã mua". Return null nếu thiếu cả 2 → caller
 * hide block thay vì show "★0 · 0 đã mua" (anti-fake-trust).
 */
export function formatSocialProof(rating?: number, salesCount?: number): string | null {
  const parts: string[] = [];
  if (typeof rating === "number" && rating > 0) parts.push(`★${rating.toFixed(1)}`);
  if (typeof salesCount === "number" && salesCount > 0) {
    let label: string;
    if (salesCount >= 10000) label = `${Math.floor(salesCount / 1000)}k đã mua`;
    else if (salesCount >= 1000) label = `${(Math.floor(salesCount / 100) / 10).toFixed(1)}k đã mua`;
    else label = `${salesCount} đã mua`;
    parts.push(label);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

const shortDateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });

/** "DD/MM" — dùng cho verified-price chip. Trả "" nếu input rỗng/không hợp lệ. */
export function formatShortDate(input?: string | Date | null): string {
  if (!input) return "";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return shortDateFmt.format(date);
}

/** True nếu updatedAt nằm trong 7 ngày qua. */
export function isVerifiedRecent(updatedAt?: string | null, now: Date = new Date()): boolean {
  if (!updatedAt) return false;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return false;
  const diffMs = now.getTime() - date.getTime();
  return diffMs >= 0 && diffMs <= 7 * 24 * 3_600_000;
}

/**
 * "Vừa cập nhật" / "X giờ trước" / "X ngày trước" / "DD/MM". Dùng cho intro paragraph
 * niche page. Không dùng `Intl.RelativeTimeFormat` để giữ output tự nhiên tiếng Việt.
 */
export function formatRelativeShort(input?: string | Date | null, now: Date = new Date()): string {
  if (!input) return "hôm nay";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "hôm nay";
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "vừa cập nhật";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "vừa cập nhật";
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return `ngày ${shortDateFmt.format(date)}`;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.-]/g, "");
      if (cleaned.length > 0) {
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return undefined;
}

function pickStringArray(source: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      const items = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
      if (items.length > 0) return items;
    }
  }
  return undefined;
}

/**
 * Chuẩn hoá Product (scrapedData kiểu Json) thành ProductView ổn định để render.
 * Mục đích: tách logic chấp nhận nhiều schema khác nhau khỏi UI.
 */
export function normalizeProduct(product: ProductItem): ProductView {
  const raw = (product.scrapedData ?? {}) as Record<string, unknown>;

  const price = pickNumber(raw, ["price", "salePrice", "currentPrice", "amount", "annualFee", "monthlyFee"]);
  const originalPrice = pickNumber(raw, ["originalPrice", "listPrice", "msrp", "regularPrice"]);
  const rating = pickNumber(raw, ["rating", "stars", "score"]);
  const reviewCount = pickNumber(raw, ["reviewCount", "reviews", "ratingCount"]);
  const salesCount = pickNumber(raw, ["salesCount", "sold", "soldCount", "purchasedCount", "soldQuantity"]);

  let discountPercent: number | undefined;
  if (price && originalPrice && originalPrice > price) {
    discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
  } else {
    const explicit = pickNumber(raw, ["discountPercent", "discount", "off"]);
    if (explicit) discountPercent = Math.round(explicit);
  }

  const store =
    product.shop?.name?.trim() ||
    pickString(raw, ["store", "shop", "merchant", "seller", "network"]) ||
    product.network;

  return {
    id: product.id,
    nicheId: product.nicheId,
    network: product.network,
    name: product.name,
    brand: pickString(raw, ["brand", "manufacturer", "bank", "issuer"]),
    store,
    image: pickString(raw, ["image", "imageUrl", "thumbnail", "photo"]),
    description: pickString(raw, ["description", "summary", "tagline"]),
    category: pickString(raw, ["category", "type"]),
    price,
    originalPrice,
    currency: pickString(raw, ["currency"]) ?? "VND",
    rating: rating !== undefined ? Math.min(5, Math.max(0, rating)) : undefined,
    reviewCount,
    badge: pickString(raw, ["badge", "tag", "label"]),
    highlights: pickStringArray(raw, ["highlights", "features", "perks", "benefits"]),
    discountPercent,
    salesCount,
    storeTier: inferStoreTier(store),
    updatedAt: product.updatedAt,
    affiliateUrl: product.affiliateUrl,
    shop: product.shop ?? null,
    raw
  };
}
