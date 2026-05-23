import { Controller, Get, Query } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("coupons")
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

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
