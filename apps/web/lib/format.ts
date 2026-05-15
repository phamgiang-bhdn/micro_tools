import type { ProductItem, ProductView } from "./types";

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

  let discountPercent: number | undefined;
  if (price && originalPrice && originalPrice > price) {
    discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
  } else {
    const explicit = pickNumber(raw, ["discountPercent", "discount", "off"]);
    if (explicit) discountPercent = Math.round(explicit);
  }

  return {
    id: product.id,
    categoryId: product.categoryId,
    network: product.network,
    name: product.name,
    brand: pickString(raw, ["brand", "manufacturer", "bank", "issuer"]),
    store: pickString(raw, ["store", "shop", "merchant", "seller", "network"]) ?? product.network,
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
    raw
  };
}
