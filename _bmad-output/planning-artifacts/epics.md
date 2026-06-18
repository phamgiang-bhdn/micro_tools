# Epic 1 — Trust-safe storefront states

> Nguồn discovery: audit storefront 2026-06-18 (Mary/analyst). Mục tiêu: với một site affiliate mới mà giá trị cốt lõi là *niềm tin*, mọi ngõ cụt (404/empty/redirect lỗi) phải được xử lý sao cho user phân biệt được "sắp có / đang cập nhật" vs "link hỏng / lỗi hệ thống", và đường tiền (click → affiliate) không bao giờ im lặng thất bại.

## Bối cảnh kỹ thuật (đã verify bằng code, KHÔNG đoán)

- `GET /niches` chỉ trả `status: "ACTIVE"` ([apps/api/src/modules/niches/niches.controller.ts:14](../../apps/api/src/modules/niches/niches.controller.ts)) → home filter chip đã không hiện niche INACTIVE. Vấn đề còn lại nằm ở **curated grid hardcode** trỏ niche có thể INACTIVE.
- `GET /niches/:slug` **404 mọi niche không-ACTIVE** ([niches.controller.ts:46](../../apps/api/src/modules/niches/niches.controller.ts)) → `/coming-soon/[slug]` không lấy được niche INACTIVE → 404. Phụ thuộc 1 endpoint API mới (status-only, không lộ product).
- HITL gate còn nguyên: `/niches/:slug` chỉ include `products.where.isPublic=true`; preview product khoá nút mua qua `previewMode`. Không story nào được nới gate này.
- `trackingCode` round-trip + fallback timeout đã đúng ([apps/web/app/actions/tracking.ts](../../apps/web/app/actions/tracking.ts)). Chỉ thiếu guard `finalUrl` rỗng ở `buyAction`.

## Stories

| Key | Tên | Tóm tắt | Phụ thuộc |
|---|---|---|---|
| 1-1 | Trust-safe states (404 → ngữ cảnh) | niche INACTIVE / coupon-merchant hết hạn / session hết hạn → trang có ngữ cảnh + lead capture thay vì `notFound()` chung chung | 1-2 (API status endpoint) cho phần niche |
| 1-2 | Coming-soon reachability + curated routing | API trả niche INACTIVE (status-only); curated grid trỏ niche INACTIVE sang `/coming-soon/<slug>` thay vì 404 | nền cho 1-1 |
| 1-3 | Buy-button safe redirect | `buyAction` guard `finalUrl` rỗng (affiliateUrl thiếu) → báo lỗi rõ thay vì `redirect("")` vỡ | độc lập |
| 1-4 | Distinguish empty vs error | Tách "rỗng vì đang xây" vs "rỗng vì lỗi tải" ở AI result / deal-hot / coupon (home đã có `loadError`, nhân rộng pattern) | độc lập |

## Thứ tự đề xuất
1-2 → 1-1 (vì 1-1 phần niche cần endpoint của 1-2). 1-3 và 1-4 chạy song song bất kỳ lúc nào.
