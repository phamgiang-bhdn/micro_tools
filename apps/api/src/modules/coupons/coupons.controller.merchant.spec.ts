import { CouponsController } from "./coupons.controller";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * RED tests — Story 1.2 AC #5 / Story 1.1 decision B (Epic 1: Trust-safe storefront states).
 *
 * Mục tiêu: `GET /coupons/merchants/:slug` trả {slug,display,exists} với `exists` tính trên
 * MỌI coupon (kể cả inactive/expired) — để story 1-1 phân biệt "merchant thật hết mã"
 * (→ 200 empty) vs "slug lạ" (→ 404). Nếu query lọc isActive sẽ 404 oan merchant thật.
 *
 * CỐ Ý đỏ tới khi `CouponsController.getMerchantExists` được implement.
 * Chạy: npm run test:api -- coupons.controller.merchant
 */
describe("CouponsController.getMerchantExists (Story 1.2 AC#5 — RED)", () => {
  function makeController(findFirst: jest.Mock): {
    controller: CouponsController;
    findFirst: jest.Mock;
  } {
    const prismaMock = { coupon: { findFirst } } as unknown as PrismaService;
    return { controller: new CouponsController(prismaMock), findFirst };
  }

  const callMerchant = (
    controller: CouponsController,
    slug: string
  ): Promise<{ slug: string; display: string | null; exists: boolean }> =>
    (
      controller as unknown as {
        getMerchantExists(slug: string): Promise<{ slug: string; display: string | null; exists: boolean }>;
      }
    ).getMerchantExists(slug);

  // Happy: merchant tồn tại (có row) → exists:true + display
  it("exists:true khi có ít nhất 1 coupon row", async () => {
    const { controller } = makeController(
      jest.fn().mockResolvedValue({ merchantDisplay: "Shopee" })
    );

    const result = await callMerchant(controller, "shopee");

    expect(result).toEqual({ slug: "shopee", display: "Shopee", exists: true });
  });

  // Lỗi/biên: slug lạ → exists:false, display:null (story 1-1 sẽ notFound())
  it("exists:false khi không có coupon row nào", async () => {
    const { controller } = makeController(jest.fn().mockResolvedValue(null));

    const result = await callMerchant(controller, "khong-co-thuc");

    expect(result.exists).toBe(false);
    expect(result.display).toBeNull();
  });

  // Then-chốt (decision B): query KHÔNG được lọc isActive/expiresAt — merchant thật đang
  // hết mã active vẫn phải exists:true.
  it("đếm tồn tại trên MỌI coupon — KHÔNG lọc isActive/expiresAt", async () => {
    const findFirst = jest.fn().mockResolvedValue({ merchantDisplay: "Tiki" });
    const { controller } = makeController(findFirst);

    await callMerchant(controller, "tiki");

    const arg = findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({ merchantSlug: "tiki" });
    expect(arg.where).not.toHaveProperty("isActive");
    expect(arg.where).not.toHaveProperty("expiresAt");
    expect(arg.where).not.toHaveProperty("OR");
  });
});
