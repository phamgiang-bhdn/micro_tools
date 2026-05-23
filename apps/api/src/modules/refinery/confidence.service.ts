import { Injectable } from "@nestjs/common";
import { Niche, Product } from "@prisma/client";

export interface ConfidenceResult {
  score: number;
  reasons: string[];
}

/**
 * STORY-09: deterministic confidence score 0-100 cho Refinery auto-approve.
 *
 * Rules (additive):
 * - +20 ảnh URL valid
 * - +20 giá > 0
 * - +15 discount ≥ 15%
 * - +5 discount ≥ 30% (bonus)
 * - +20 store badge Mall/Trading/Official
 * - +10 brand identified
 * - +10 title sạch (≤120 ký tự, không spam)
 * - +10 schema match ≥ 50%
 * - +5 salesCount > 10
 *
 * Penalty (negative):
 * - -40 thiếu ảnh
 * - -40 thiếu giá
 * - -30 giá < 50k (suspicious fake)
 * - -20 title spam (★★★, !!!, 【...】, FREESHIP HÔM NAY)
 *
 * Clamp [0, 100]. Auto-approve khi score >= REFINERY_AUTO_APPROVE_THRESHOLD (default 80).
 */
@Injectable()
export class ConfidenceService {
  compute(product: Product, niche: Niche | null): ConfidenceResult {
    let score = 0;
    const reasons: string[] = [];
    const sd = (product.scrapedData ?? {}) as Record<string, unknown>;

    const image = pickString(sd, ["image", "imageUrl", "thumbnail"]);
    if (image && /^https?:\/\//.test(image)) {
      score += 20;
      reasons.push("+20 ảnh OK");
    } else {
      score -= 40;
      reasons.push("-40 thiếu ảnh");
    }

    const price = pickNumber(sd, ["price", "salePrice", "currentPrice"]);
    const originalPrice = pickNumber(sd, ["originalPrice", "listPrice"]);
    if (typeof price === "number" && price > 0) {
      score += 20;
      reasons.push("+20 có giá");
      if (originalPrice && originalPrice > price) {
        const discount = Math.round((1 - price / originalPrice) * 100);
        if (discount >= 15) {
          score += 15;
          reasons.push(`+15 giảm ${discount}%`);
        }
        if (discount >= 30) {
          score += 5;
          reasons.push(`+5 giảm sâu ≥30%`);
        }
      }
      if (price < 50000) {
        score -= 30;
        reasons.push("-30 giá quá thấp (<50k)");
      }
    } else {
      score -= 40;
      reasons.push("-40 thiếu giá");
    }

    const store = (pickString(sd, ["store", "merchant"]) ?? "").toLowerCase();
    if (/mall|trading|official|preferred/.test(store)) {
      score += 20;
      reasons.push("+20 shop chính hãng");
    }

    const brand = pickString(sd, ["brand"]);
    if (brand && brand.length >= 2) {
      score += 10;
      reasons.push("+10 có brand");
    }

    const title = product.name ?? "";
    const isClean = title.length > 0 && title.length <= 120 && !/★{2,}|!{3,}|【.+】/.test(title);
    if (isClean) {
      score += 10;
      reasons.push("+10 title sạch");
    }
    if (/★{2,}|!{3,}|FREESHIP\s+HÔM NAY|【.+】/i.test(title)) {
      score -= 20;
      reasons.push("-20 title spam");
    }

    if (niche) {
      const schemaConfig = (niche.schemaConfig ?? {}) as Record<string, unknown>;
      const fields = Object.keys(schemaConfig);
      if (fields.length > 0) {
        const matched = fields.filter((k) => sd[k] !== undefined && sd[k] !== null && sd[k] !== "");
        const ratio = matched.length / fields.length;
        if (ratio >= 0.5) {
          score += 10;
          reasons.push(`+10 schema ${Math.round(ratio * 100)}%`);
        }
      }
    }

    const salesCount = pickNumber(sd, ["salesCount", "sold", "soldCount"]);
    if (salesCount && salesCount > 10) {
      score += 5;
      reasons.push(`+5 đã bán ${salesCount}+`);
    }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  }

  getAutoApproveThreshold(): number {
    const raw = process.env.REFINERY_AUTO_APPROVE_THRESHOLD;
    const n = raw ? parseInt(raw, 10) : 80;
    return Number.isFinite(n) ? n : 80;
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}
