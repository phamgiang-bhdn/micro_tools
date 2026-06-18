import { Controller, Get, Param, Query } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("coupons")
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  // STORY 1-2 (decision B): tồn tại merchant tính trên MỌI coupon — KHÔNG lọc
  // isActive/expiresAt. Nếu lọc active sẽ báo "không tồn tại" nhầm cho merchant thật
  // đang tạm hết mã → story 1-1 sẽ 404 oan thay vì hiện "chưa có mã".
  @Get("merchants/:slug")
  async getMerchantExists(@Param("slug") slug: string) {
    // orderBy merchantDisplay nulls:last → display deterministic + ưu tiên row có tên (review #7),
    // tránh trả null trong khi row khác cùng merchant có tên thật.
    const row = await this.prisma.coupon.findFirst({
      where: { merchantSlug: slug },
      select: { merchantDisplay: true },
      orderBy: { merchantDisplay: { sort: "asc", nulls: "last" } }
    });
    return { slug, display: row?.merchantDisplay ?? null, exists: row !== null };
  }

  @Get()
  async list(
    @Query("merchantSlug") merchantSlug?: string,
    @Query("limit") limit?: string,
    @Query("sort") sort?: string
  ) {
    const where: Prisma.CouponWhereInput = {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    };
    if (merchantSlug) where.merchantSlug = merchantSlug;
    // `expiresAt:asc` cho homepage preview (gần hết hạn lên đầu → urgency).
    // Coupon không có expiresAt cũng cần lọt vào — nulls last bằng compound order.
    const orderBy: Prisma.CouponOrderByWithRelationInput[] =
      sort === "expiresAt:asc"
        ? [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
        : [{ startsAt: "desc" }, { createdAt: "desc" }];
    return this.prisma.coupon.findMany({
      where,
      orderBy,
      take: Math.min(Math.max(Number(limit ?? 50), 1), 100)
    });
  }
}
