import { z } from "zod";

export const filterRulesSchema = z
  .object({
    minDiscountPercent: z.number().int().min(0).max(100).optional(),
    maxDiscountPercent: z.number().int().min(0).max(100).optional(),
    domains: z.array(z.string()).optional(),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    status_discount: z.union([z.literal(0), z.literal(1)]).optional(),
    customFilters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type FilterRules = z.infer<typeof filterRulesSchema>;

export const DEFAULT_FILTER_RULES: FilterRules = {
  minDiscountPercent: 0,
  status_discount: 1,
};
