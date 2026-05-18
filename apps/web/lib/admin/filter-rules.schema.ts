import { z } from "zod";

/**
 * Mirror tối thiểu của zod server-side ở `apps/api/src/modules/crawler/dto/filter-rules.dto.ts`.
 * Server zod vẫn là phòng tuyến chính; client zod chỉ để validate sớm + UX.
 */
export const filterRulesSchema = z
  .object({
    minDiscountPercent: z.number().int().min(0).max(100).optional(),
    maxDiscountPercent: z.number().int().min(0).max(100).optional(),
    domains: z.array(z.string().min(1)).optional(),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
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

export function summarizeFilterRules(rules: FilterRules | null | undefined): string {
  if (!rules || Object.keys(rules).length === 0) return "Default";
  const parts: string[] = [];
  if (rules.minDiscountPercent !== undefined && rules.minDiscountPercent > 0) {
    parts.push(`≥${rules.minDiscountPercent}%`);
  }
  if (rules.maxDiscountPercent !== undefined) parts.push(`≤${rules.maxDiscountPercent}%`);
  if (rules.priceMin !== undefined) parts.push(`giá ≥${rules.priceMin.toLocaleString("vi-VN")}`);
  if (rules.priceMax !== undefined) parts.push(`giá ≤${rules.priceMax.toLocaleString("vi-VN")}`);
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
