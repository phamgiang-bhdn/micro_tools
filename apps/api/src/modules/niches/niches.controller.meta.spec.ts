import { HttpException, HttpStatus } from "@nestjs/common";
import { NichesController } from "./niches.controller";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * RED tests — Story 1.2 (Epic 1: Trust-safe storefront states).
 *
 * Mục tiêu: `GET /niches/:slug/meta` trả {slug,name,status} cho MỌI niche tồn tại
 * (kể cả INACTIVE) mà KHÔNG lộ products/scrapedData (HITL gate).
 *
 * Các test này CỐ Ý đỏ cho tới khi `NichesController.getNicheMeta` được implement:
 * hiện `getNicheMeta` chưa tồn tại → gọi qua cast `any` → runtime "not a function".
 * Khi implement xong, cùng test này chuyển xanh mà KHÔNG cần sửa.
 * Chạy: npm run test:api -- niches.controller.meta
 */
describe("NichesController.getNicheMeta (Story 1.2 — RED)", () => {
  function makeController(findUnique: jest.Mock): {
    controller: NichesController;
    findUnique: jest.Mock;
  } {
    const prismaMock = { niche: { findUnique } } as unknown as PrismaService;
    return { controller: new NichesController(prismaMock), findUnique };
  }

  // Gọi method chưa tồn tại qua cast — compile được giờ và cả sau khi implement.
  const callMeta = (controller: NichesController, slug: string): Promise<Record<string, unknown>> =>
    (controller as unknown as { getNicheMeta(slug: string): Promise<Record<string, unknown>> }).getNicheMeta(slug);

  // Case 1 (happy): slug ACTIVE → 200 {slug,name,status:"ACTIVE"}
  it("trả meta cho niche ACTIVE", async () => {
    const { controller, findUnique } = makeController(
      jest.fn().mockResolvedValue({ slug: "may-loc-nuoc", name: "Máy lọc nước", status: "ACTIVE" })
    );

    const result = await callMeta(controller, "may-loc-nuoc");

    expect(result).toEqual({ slug: "may-loc-nuoc", name: "Máy lọc nước", status: "ACTIVE" });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  // Case 2 (happy): slug INACTIVE → 200 {...,status:"INACTIVE"} (KHÁC /niches/:slug vốn 404)
  it("trả meta cho niche INACTIVE (không 404)", async () => {
    const { controller } = makeController(
      jest.fn().mockResolvedValue({ slug: "may-rua-bat", name: "Máy rửa bát", status: "INACTIVE" })
    );

    const result = await callMeta(controller, "may-rua-bat");

    expect(result.status).toBe("INACTIVE");
  });

  // Case 7 (lỗi): slug không tồn tại → 404 HttpException
  it("404 khi niche không tồn tại", async () => {
    const { controller } = makeController(jest.fn().mockResolvedValue(null));

    await expect(callMeta(controller, "khong-ton-tai")).rejects.toBeInstanceOf(HttpException);
    await expect(callMeta(controller, "khong-ton-tai")).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND
    });
  });

  // Case 9 (repo-risk / HITL): response KHÔNG được lộ products/scrapedData.
  it("KHÔNG include products/scrapedData — chỉ select slug/name/status", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      slug: "may-loc-khong-khi",
      name: "Máy lọc không khí",
      status: "INACTIVE"
    });
    const { controller } = makeController(findUnique);

    const result = await callMeta(controller, "may-loc-khong-khi");

    // (a) object trả về không có key nhạy cảm
    expect(result).not.toHaveProperty("products");
    expect(result).not.toHaveProperty("scrapedData");

    // (b) query Prisma dùng `select` whitelist (không `include: { products }`)
    const arg = findUnique.mock.calls[0][0];
    expect(arg).toHaveProperty("select");
    expect(arg.select).toEqual({ slug: true, name: true, status: true });
    expect(arg).not.toHaveProperty("include");
  });
});
