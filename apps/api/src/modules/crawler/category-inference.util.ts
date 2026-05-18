/**
 * Map free-text category/name → categorySlug nội bộ.
 *
 * @deprecated cho crawler-cycle path: dùng `Campaign.categoryId` (set tay ở `/admin/campaigns`)
 *   sau STORY-03 của sprint at-source-of-truth. Crawler-cycle hiện lấy slug deterministic từ
 *   `Campaign.category.slug`, KHÔNG infer từ free-text.
 *
 * Chỉ còn `web-scrape.client.ts` (path paste URL tay) dùng làm fallback khi admin không truyền
 * `categorySlug` rõ ràng. Keyword table chưa cập nhật theo niche v1 (`robot-hut-bui-lau-nha`,
 * `may-loc-khong-khi`) — vì path inference này ngoài scope crawler-cycle, không ảnh hưởng
 * pipeline chính. Khi web-scrape không còn dùng → xoá toàn file.
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
