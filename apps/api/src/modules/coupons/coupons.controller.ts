import { Controller, Get, Query } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("coupons")
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query("merchantSlug") merchantSlug?: string,
    @Query("limit") limit?: string
  ) {
    const where: Prisma.CouponWhereInput = {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    };
    if (merchantSlug) where.merchantSlug = merchantSlug;
    return this.prisma.coupon.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      take: Math.min(Math.max(Number(limit ?? 50), 1), 100)
    });
  }
}
