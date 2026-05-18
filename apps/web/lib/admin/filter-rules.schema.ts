import { z } from "zod";

/**
 * Mirror tối thiểu của zod server-side ở `apps/api/src/modules/crawler/dto/filter-rules.dto.ts`.
 * Server zod vẫn là phòng tuyến chính; client zod chỉ để validate sớm + UX.
 */
export const filterRulesSchema = z
  .object({
    minDiscountPercent: z.number().int().min(0).max(100).optional(),
    maxDiscountPercent: z.number().int().min(0).max(100).optional(),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    salePriceMin: z.number().min(0).optional(),
    salePriceMax: z.number().min(0).optional(),
    discountAmountMin: z.number().min(0).optional(),
    discountAmountMax: z.number().min(0).optional(),
    updateLookbackDays: z.number().int().min(1).max(365).optional(),
    domains: z.array(z.string().min(1)).optional(),
    status_discount: z.union([z.literal(0), z.literal(1)]).optional()
  })
  .strict();

export type FilterRules = z.infer<typeof filterRulesSchema>;

export const DEFAULT_FILTER_RULES: FilterRules = {
  minDiscountPercent: 0,
  status_discount: 1
};

export const STATUS_DISCOUNT_OPTIONS = [
  { value: "1", label: "Chỉ sản phẩm có discount" },
  { value: "0", label: "Chỉ sản phẩm KHÔNG discount" }
];

const fmtVnd = (v: number): string => v.toLocaleString("vi-VN");

export function summarizeFilterRules(rules: FilterRules | null | undefined): string {
  if (!rules || Object.keys(rules).length === 0) return "Default";
  const parts: string[] = [];
  if (rules.minDiscountPercent !== undefined && rules.minDiscountPercent > 0) {
    parts.push(`≥${rules.minDiscountPercent}%`);
  }
  if (rules.maxDiscountPercent !== undefined) parts.push(`≤${rules.maxDiscountPercent}%`);
  if (rules.priceMin !== undefined) parts.push(`giá ≥${fmtVnd(rules.priceMin)}`);
  if (rules.priceMax !== undefined) parts.push(`giá ≤${fmtVnd(rules.priceMax)}`);
  if (rules.salePriceMin !== undefined) parts.push(`sale ≥${fmtVnd(rules.salePriceMin)}`);
  if (rules.salePriceMax !== undefined) parts.push(`sale ≤${fmtVnd(rules.salePriceMax)}`);
  if (rules.discountAmountMin !== undefined) parts.push(`giảm ≥${fmtVnd(rules.discountAmountMin)}đ`);
  if (rules.discountAmountMax !== undefined) parts.push(`giảm ≤${fmtVnd(rules.discountAmountMax)}đ`);
  if (rules.updateLookbackDays !== undefined) parts.push(`update ≤${rules.updateLookbackDays}d`);
  if (rules.domains && rules.domains.length > 0) parts.push(rules.domains.join(", "));
  if (rules.status_discount === 0) parts.push("no-discount");
  return parts.length > 0 ? parts.join(", ") : "Default";
}

export function slugifyVi(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
