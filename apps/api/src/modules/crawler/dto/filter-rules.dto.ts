import { z } from "zod";

/**
 * Per-assignment filterRules.
 * - 6 field cũ giữ nguyên (backward compat).
 * - 5 field mới mở rộng theo những param AT `/v1/datafeeds` hỗ trợ nhưng FilterRules chưa cover:
 *   `salePriceMin/Max` (giá sau giảm), `discountAmountMin/Max` (VND giảm),
 *   `updateLookbackDays` (incremental sync — chỉ pull offer thay đổi trong N ngày qua).
 */
export const filterRulesSchema = z
  .object({
    // Discount %
    minDiscountPercent: z.number().int().min(0).max(100).optional(),
    maxDiscountPercent: z.number().int().min(0).max(100).optional(),
    // Giá gốc (VND)
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    // Giá sau giảm (VND) — KHÁC priceMin/Max (`price_from/to` của AT lọc theo giá gốc)
    salePriceMin: z.number().min(0).optional(),
    salePriceMax: z.number().min(0).optional(),
    // Số tiền được giảm tuyệt đối (VND)
    discountAmountMin: z.number().min(0).optional(),
    discountAmountMax: z.number().min(0).optional(),
    // Incremental: chỉ pull offer có update_time trong N ngày qua. 1-365.
    updateLookbackDays: z.number().int().min(1).max(365).optional(),
    // Hành vi
    domains: z.array(z.string()).optional(),
    status_discount: z.union([z.literal(0), z.literal(1)]).optional(),
    customFilters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type FilterRules = z.infer<typeof filterRulesSchema>;

export const DEFAULT_FILTER_RULES: FilterRules = {
  minDiscountPercent: 0,
  status_discount: 1,
};
