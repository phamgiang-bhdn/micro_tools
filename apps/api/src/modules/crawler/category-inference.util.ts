/**
 * Map free-text category/name từ bất kỳ affiliate source nào → categorySlug nội bộ.
 * Dùng chung cho mọi client (Accesstrade, Shopee, Lazada, TikTok, web-scrape) để mỗi
 * network không tự định nghĩa lại quy tắc của riêng mình.
 */
const CATEGORY_BY_KEYWORD: Array<[RegExp, string]> = [
  [/laptop|máy tính|tablet|điện thoại|tai nghe|loa|monitor|màn hình|smart\s?tv|console|gaming|bàn phím|chuột/i, "tech-gadgets"],
  [/làm đẹp|son|kem|chống nắng|serum|skincare|mỹ phẩm|dior|chanel|sk[\s-]?ii|hasaki/i, "beauty-skincare"],
  [/du lịch|khách sạn|tour|vé|booking|agoda|traveloka|hotel|flight|chuyến bay|vinpearl/i, "travel-deals"],
  [/gia dụng|nồi|máy lọc|máy hút|robot|airpurifier|home|bếp|nồi chiên/i, "home-appliances"],
  [/thẻ|card|tín dụng|cashback|visa|mastercard|ngân hàng|amex/i, "credit-card-compare"]
];

const DEFAULT_CATEGORY_SLUG = "tech-gadgets";

export function inferCategorySlug(category?: string, name?: string): string {
  const target = `${category ?? ""} ${name ?? ""}`;
  for (const [pattern, slug] of CATEGORY_BY_KEYWORD) {
    if (pattern.test(target)) return slug;
  }
  return DEFAULT_CATEGORY_SLUG;
}
