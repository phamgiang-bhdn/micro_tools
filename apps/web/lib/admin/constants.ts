/**
 * Centralized constants cho mọi màn /admin. Mọi enum/label/searchParam key dùng ở
 * UI hoặc server action PHẢI import từ đây — đừng tự hardcode string nữa.
 *
 * Quy ước:
 *  - `*_VALUES`        : tuple `as const` để z.enum và type narrowing.
 *  - `*_META`          : record { label, tone? } để render pill/select option.
 *  - `*_OPTIONS`       : Array<{ value, label }> đã sort sẵn cho Select component.
 *  - `ADMIN_PARAMS`    : key cho URLSearchParams (search/page/status/…).
 */
import type { Tone } from "../../components/admin/ui/status-pill";

// ===== Affiliate network =====

export const NETWORK_VALUES = ["ACCESSTRADE", "SHOPEE", "TIKTOK", "LAZADA"] as const;
export type AffiliateNetwork = (typeof NETWORK_VALUES)[number];

export const NETWORK_META: Record<AffiliateNetwork, { label: string; tone: Tone }> = {
  ACCESSTRADE: { label: "AccessTrade", tone: "info" },
  SHOPEE: { label: "Shopee", tone: "warning" },
  TIKTOK: { label: "TikTok", tone: "danger" },
  LAZADA: { label: "Lazada", tone: "neutral" }
};

export const NETWORK_OPTIONS = NETWORK_VALUES.map((v) => ({
  value: v,
  label: NETWORK_META[v].label
}));

// ===== Article =====

export const ARTICLE_STATUS_VALUES = [
  // V2 pipeline
  "DRAFT_BRIEF",
  "RESEARCHING",
  "REVIEWS_SCRAPED",
  "OUTLINE_READY",
  "IMAGES_READY",
  "DRAFTING",
  "SELF_CRITIQUED",
  "FACT_CHECKED",
  "PENDING_REVIEW",
  "NEEDS_REVISION",
  // Terminal
  "PUBLISHED",
  "ARCHIVED",
  "FAILED"
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUS_VALUES)[number];

export const ARTICLE_STATUS_META: Record<ArticleStatus, { label: string; tone: Tone }> = {
  DRAFT_BRIEF: { label: "Đang lập brief", tone: "info" },
  RESEARCHING: { label: "Đang research", tone: "info" },
  REVIEWS_SCRAPED: { label: "Đã thu review", tone: "info" },
  OUTLINE_READY: { label: "Outline xong", tone: "info" },
  IMAGES_READY: { label: "Ảnh sẵn sàng", tone: "info" },
  DRAFTING: { label: "Đang viết", tone: "info" },
  SELF_CRITIQUED: { label: "Đã tự kiểm tra", tone: "info" },
  FACT_CHECKED: { label: "Đã fact-check", tone: "info" },
  PENDING_REVIEW: { label: "Chờ admin duyệt", tone: "warning" },
  NEEDS_REVISION: { label: "Cần sửa thủ công", tone: "danger" },
  PUBLISHED: { label: "Đã đăng", tone: "success" },
  ARCHIVED: { label: "Lưu trữ", tone: "neutral" },
  FAILED: { label: "Lỗi", tone: "danger" }
};

export const PIPELINE_STAGES = [
  { key: "brief-builder", label: "Định hướng", color: "info" },
  { key: "research", label: "Tra cứu", color: "info" },
  { key: "review-scraper", label: "Đánh giá", color: "info" },
  { key: "outline", label: "Dàn ý", color: "info" },
  { key: "image", label: "Ảnh", color: "info" },
  { key: "writer", label: "Viết bài", color: "info" },
  { key: "critic", label: "Kiểm tra", color: "info" },
  { key: "fact-check", label: "Đối chiếu", color: "info" }
] as const;

export const ARTICLE_STATUS_OPTIONS = ARTICLE_STATUS_VALUES.map((v) => ({
  value: v,
  label: ARTICLE_STATUS_META[v].label
}));

export const ARTICLE_TYPE_VALUES = ["BUYING_GUIDE", "REVIEW"] as const;
export type ArticleType = (typeof ARTICLE_TYPE_VALUES)[number];

export const ARTICLE_TYPE_META: Record<ArticleType, { label: string }> = {
  BUYING_GUIDE: { label: "Hướng dẫn mua" },
  REVIEW: { label: "Review" }
};

export const ARTICLE_TYPE_OPTIONS = ARTICLE_TYPE_VALUES.map((v) => ({
  value: v,
  label: ARTICLE_TYPE_META[v].label
}));

// ===== Campaign =====

export const CAMPAIGN_STATUS_VALUES = [
  "APPLIED",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "INACTIVE"
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS_VALUES)[number];

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; tone: Tone }> = {
  APPROVED: { label: "Đã duyệt", tone: "success" },
  APPLIED: { label: "Đã apply", tone: "info" },
  PAUSED: { label: "Tạm dừng", tone: "warning" },
  REJECTED: { label: "Từ chối", tone: "danger" },
  INACTIVE: { label: "Ngừng", tone: "neutral" }
};

export const CAMPAIGN_STATUS_OPTIONS = CAMPAIGN_STATUS_VALUES.map((v) => ({
  value: v,
  label: CAMPAIGN_STATUS_META[v].label
}));

// ===== Niche =====

export const NICHE_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;
export type NicheStatus = (typeof NICHE_STATUS_VALUES)[number];

export const NICHE_STATUS_META: Record<NicheStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Đang hiện", tone: "success" },
  INACTIVE: { label: "Ẩn", tone: "neutral" }
};

export const NICHE_STATUS_OPTIONS = NICHE_STATUS_VALUES.map((v) => ({
  value: v,
  label: NICHE_STATUS_META[v].label
}));

// ===== Generic active toggle (coupons, etc.) =====

export const ACTIVE_TOGGLE_OPTIONS = [
  { value: "true", label: "Đang chạy" },
  { value: "false", label: "Tạm tắt" }
];

// ===== Roles =====

export const ADMIN_ROLE_VALUES = ["viewer", "reviewer", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLE_VALUES)[number];

// ===== URL searchParam keys =====
// Mỗi lần thêm filter mới trên 1 page, thêm key ở đây. Page parse từ search params
// và FilterBar set hidden field theo key này — không nơi nào hardcode chuỗi "search"/"page" nữa.

export const ADMIN_PARAMS = {
  search: "search",
  page: "page",
  status: "status",
  type: "type",
  network: "network",
  niche: "nicheId",
  isPublic: "isPublic",
  isActive: "isActive",
  from: "from",
  to: "to",
  tab: "tab",
  trackingCode: "trackingCode"
} as const;

export type AdminParamKey = keyof typeof ADMIN_PARAMS;

// ===== Default pagination =====

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ===== Tiny helpers =====

export function buildAdminHref(
  base: string,
  params: Record<string, string | number | undefined | null>
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    next.set(k, String(v));
  }
  const s = next.toString();
  return s ? `${base}?${s}` : base;
}
