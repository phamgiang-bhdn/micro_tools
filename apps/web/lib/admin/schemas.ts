/**
 * Zod schemas cho mọi form admin. Mỗi entity có 2 schema:
 *   - `*CreateSchema` : payload tạo mới (validate đầy đủ)
 *   - `*UpdateSchema` : payload sửa (optional + partial)
 *
 * Form dialog parse + validate client-side; server action ăn payload đã parse
 * (sau migrate). Khi muốn thêm field mới, cập nhật cả 2 schema.
 */
import { z } from "zod";
import {
  ARTICLE_STATUS_VALUES,
  ARTICLE_TYPE_VALUES,
  CAMPAIGN_STATUS_VALUES,
  CATEGORY_STATUS_VALUES,
  NETWORK_VALUES
} from "./constants";

// Tiny shared bits

const slug = z
  .string()
  .min(2, "Slug tối thiểu 2 ký tự")
  .max(80, "Slug tối đa 80 ký tự")
  .regex(/^[a-z0-9-]+$/, "Slug chỉ chứa a-z, 0-9, dấu gạch ngang");

const optionalISODate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v && String(v).trim() ? String(v).trim() : null))
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), { message: "Ngày không hợp lệ" });

const jsonString = (label: string) =>
  z
    .string()
    .trim()
    .default("{}")
    .superRefine((v, ctx) => {
      if (!v) return;
      try {
        JSON.parse(v);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} phải là JSON hợp lệ` });
      }
    });

// ===== Coupon =====

const couponBase = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Mã ≥ 2 ký tự")
    .max(40, "Mã ≤ 40 ký tự")
    .regex(/^[A-Z0-9-_]+$/, "Mã chỉ chứa A-Z, 0-9, - _"),
  description: z.string().trim().max(500).nullable().optional(),
  discountPercent: z
    .number()
    .int()
    .min(1, "Giảm 1–100%")
    .max(100, "Giảm 1–100%")
    .nullable(),
  network: z.enum(NETWORK_VALUES).nullable().optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  productId: z.string().trim().min(1).nullable().optional(),
  expiresAt: optionalISODate,
  isActive: z.boolean().default(true)
});

export const couponCreateSchema = couponBase.superRefine((data, ctx) => {
  if (data.categoryId && data.productId) {
    ctx.addIssue({
      path: ["productId"],
      code: "custom",
      message: "Chỉ chọn 1 trong: danh mục hoặc sản phẩm"
    });
  }
});
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

export const couponUpdateSchema = couponBase.partial().extend({
  id: z.string().min(1, "Thiếu id")
});
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;

// ===== Campaign =====

export const campaignCreateSchema = z.object({
  network: z.enum(NETWORK_VALUES, { message: "Chọn network" }),
  externalId: z
    .string()
    .trim()
    .min(2, "externalId ≥ 2 ký tự")
    .regex(/^[a-z0-9-]+$/, "externalId chỉ chứa a-z, 0-9, gạch ngang"),
  name: z.string().trim().min(2, "Tên ≥ 2 ký tự").max(200),
  merchantName: z.string().trim().max(200).nullable().optional(),
  status: z.enum(CAMPAIGN_STATUS_VALUES).default("APPLIED"),
  commissionNote: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignCreateSchema.partial().extend({
  id: z.string().min(1, "Thiếu id"),
  appliedAt: optionalISODate,
  approvedAt: optionalISODate
});
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

// ===== Category =====

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Tên ≥ 2 ký tự").max(120),
  slug,
  schemaConfig: jsonString("schemaConfig"),
  seoTitle: z.string().trim().max(180).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional()
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  id: z.string().min(1, "Thiếu id"),
  status: z.enum(CATEGORY_STATUS_VALUES).optional()
});
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

// ===== Product =====

export const productCreateSchema = z.object({
  name: z.string().trim().min(2, "Tên ≥ 2 ký tự").max(220),
  affiliateUrl: z.string().trim().url("URL affiliate không hợp lệ"),
  categoryId: z.string().min(1, "Chọn danh mục"),
  network: z.enum(NETWORK_VALUES, { message: "Chọn network" }),
  isPublic: z.boolean().default(false),
  scrapedData: jsonString("scrapedData").optional()
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().min(1, "Thiếu id")
});
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// ===== Article =====

export const articleGenerateSchema = z
  .object({
    type: z.enum(ARTICLE_TYPE_VALUES),
    topic: z.string().trim().min(5, "Chủ đề ≥ 5 ký tự").max(300),
    categoryId: z.string().trim().min(1).optional(),
    productRef: z.string().trim().min(1).optional(),
    pinnedProductIds: z.array(z.string().min(1)).default([])
  })
  .superRefine((data, ctx) => {
    if (data.type === "BUYING_GUIDE" && !data.categoryId) {
      ctx.addIssue({
        path: ["categoryId"],
        code: "custom",
        message: "Hướng dẫn mua cần chọn danh mục"
      });
    }
    if (data.type === "REVIEW" && !data.productRef) {
      ctx.addIssue({
        path: ["productRef"],
        code: "custom",
        message: "Review cần slug / URL sản phẩm"
      });
    }
  });
export type ArticleGenerateInput = z.infer<typeof articleGenerateSchema>;

export const articleUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2, "Tiêu đề ≥ 2 ký tự").max(220),
  slug,
  excerpt: z.string().trim().max(500).nullable().optional(),
  body: z.string().trim().min(1, "Nội dung không được rỗng"),
  metaTitle: z.string().trim().max(180).nullable().optional(),
  metaDescription: z.string().trim().max(320).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  productIds: z.array(z.string().min(1)).default([])
});
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;

export const articleScheduleSchema = z.object({
  id: z.string().min(1),
  scheduledAt: optionalISODate
});
export type ArticleScheduleInput = z.infer<typeof articleScheduleSchema>;

// Re-export status enums (used by FilterBar params etc.)
export const articleStatusSchema = z.enum(ARTICLE_STATUS_VALUES);
export const articleTypeSchema = z.enum(ARTICLE_TYPE_VALUES);
