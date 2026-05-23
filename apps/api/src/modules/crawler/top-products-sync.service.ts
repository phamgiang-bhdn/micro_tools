import { Injectable, Logger } from "@nestjs/common";
import { Prisma, TopProductSnapshot } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SyncStatusService } from "../../services/sync-status.service";
import { AccesstradeClient } from "./clients/accesstrade.client";

export interface TopProductsSyncResult {
  created: number;
  date: string;
  skipped: boolean;
}

export const TOP_PRODUCTS_LOOKBACK_DAYS = 7;

@Injectable()
export class TopProductsSyncService {
  private readonly logger = new Logger(TopProductsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient,
    private readonly syncStatus: SyncStatusService
  ) {}

  async syncDailySnapshot(): Promise<TopProductsSyncResult> {
    return this.syncStatus.wrap("top_products", () => this.syncDailySnapshotInner());
  }

  private async syncDailySnapshotInner(): Promise<TopProductsSyncResult> {
    const today = startOfDay(new Date());

    const existing = await this.prisma.topProductSnapshot.findFirst({
      where: { snapshotDate: today }
    });
    if (existing) {
      this.logger.log(
        `Top products snapshot ${today.toISOString().slice(0, 10)} đã có — skip`
      );
      return { created: 0, date: today.toISOString(), skipped: true };
    }

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - TOP_PRODUCTS_LOOKBACK_DAYS);

    const products = await this.accesstrade.fetchTopProducts({ dateFrom, dateTo });
    if (products.length === 0) {
      this.logger.warn("AT trả 0 top_products — không tạo snapshot");
      return { created: 0, date: today.toISOString(), skipped: false };
    }

    let created = 0;
    for (let i = 0; i < products.length; i += 1) {
      const p = products[i];
      if (!p.product_id || !p.aff_link) continue;
      await this.prisma.topProductSnapshot.create({
        data: {
          snapshotDate: today,
          position: i + 1,
          atProductId: p.product_id,
          name: p.name,
          brand: p.brand ?? null,
          image: p.image ?? null,
          link: p.link,
          affLink: p.aff_link,
          categoryName: p.category_name ?? null,
          productCategory: p.product_category ?? null,
          price: typeof p.price === "number" ? new Prisma.Decimal(p.price) : null,
          discount: typeof p.discount === "number" ? new Prisma.Decimal(p.discount) : null,
          merchant: p.merchant ?? null,
          shortDesc: p.short_desc ? p.short_desc.slice(0, 500) : null,
          atRawData: p as unknown as Prisma.InputJsonValue
        }
      });
      created += 1;
    }

    this.logger.log(
      `Top products snapshot created: ${created} items for ${today.toISOString().slice(0, 10)}`
    );
    return { created, date: today.toISOString(), skipped: false };
  }

  async getLatestSnapshot(
    limit = 12
  ): Promise<Array<TopProductSnapshot & { merchantDisplay: string | null }>> {
    const latest = await this.prisma.topProductSnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    });
    if (!latest) return [];
    const rows = await this.prisma.topProductSnapshot.findMany({
      where: { snapshotDate: latest.snapshotDate },
      orderBy: { position: "asc" },
      take: Math.min(Math.max(limit, 1), 50)
    });
    const merchantSlugs = Array.from(
      new Set(rows.map((r) => r.merchant?.toLowerCase()).filter((m): m is string => Boolean(m)))
    );
    const campaigns = merchantSlugs.length
      ? await this.prisma.campaign.findMany({
          where: { merchantName: { in: merchantSlugs, mode: "insensitive" } },
          select: { name: true, merchantName: true }
        })
      : [];
    const nameBySlug = new Map<string, string>();
    for (const c of campaigns) {
      if (c.merchantName) nameBySlug.set(c.merchantName.toLowerCase(), c.name);
    }
    return rows.map((r) => ({
      ...r,
      merchantDisplay: r.merchant ? nameBySlug.get(r.merchant.toLowerCase()) ?? null : null
    }));
  }
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
