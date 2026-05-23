import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface RealBestsellerStats {
  productId: string;
  totalSoldUnits: number;
  orderCount: number;
  totalCommission: number;
  windowDays: number;
}

/**
 * Loop 2: aggregate `OrderProduct` → "Bán chạy thật" ranking per window/niche.
 * Khác top discount (storefront), khác top_products (AT marketing) — đây là evidence
 * thực mua qua dealvault.
 */
@Injectable()
export class RealBestsellerService {
  constructor(private readonly prisma: PrismaService) {}

  async getTopReal(opts: { days?: number; nicheSlug?: string; limit?: number } = {}) {
    const days = opts.days ?? 7;
    const limit = opts.limit ?? 10;
    const since = new Date(Date.now() - days * 86400000);

    const nicheFilter = opts.nicheSlug
      ? Prisma.sql`AND op."matchedProductId" IN (
          SELECT p.id FROM "Product" p
          JOIN "Niche" n ON n.id = p."nicheId"
          WHERE n.slug = ${opts.nicheSlug}
        )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{ productId: string; totalQty: number; totalCommission: number; orderCount: number }>
    >`
      SELECT
        op."matchedProductId"::text as "productId",
        SUM(op."approvedQuantity")::int as "totalQty",
        SUM(op."approvedCommission")::float as "totalCommission",
        COUNT(DISTINCT op."conversionWebhookId")::int as "orderCount"
      FROM "OrderProduct" op
      WHERE op."matchedProductId" IS NOT NULL
        AND op."salesTime" >= ${since}
        ${nicheFilter}
      GROUP BY op."matchedProductId"
      ORDER BY "totalQty" DESC, "totalCommission" DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const productIds = rows.map((r) => r.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isPublic: true },
      include: { niche: { select: { slug: true, name: true } } }
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return rows
      .map((r) => {
        const p = byId.get(r.productId);
        if (!p) return null;
        return {
          ...p,
          realBestsellerStats: {
            productId: r.productId,
            totalSoldUnits: r.totalQty,
            orderCount: r.orderCount,
            totalCommission: r.totalCommission,
            windowDays: days
          } satisfies RealBestsellerStats
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }
}
