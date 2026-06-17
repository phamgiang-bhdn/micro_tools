import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { classifyPrice, PriceIntel, PriceObservation } from "./price-intelligence.types";

export interface SnapshotInput {
  /** Giá hiệu lực (salePrice ?? price). */
  price: number;
  originalPrice?: number | null;
  currency?: string | null;
  source?: string | null;
}

export interface PriceHistoryPoint {
  capturedAt: string;
  price: number;
  originalPrice: number | null;
}

const MAX_SNAPSHOTS_READ = 500;

/**
 * V4 moat: ghi lịch sử giá per Product + phán verdict (thật/ảo/đáy) deterministic.
 * Đặt trong CrawlerModule vì capture là crawl-time concern (InsightsModule import CrawlerModule
 * → để service này ở Insights sẽ tạo circular dep). Export cho PriceController (read side).
 */
@Injectable()
export class PriceIntelligenceService {
  private readonly logger = new Logger(PriceIntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi snapshot nếu giá đổi so với snapshot gần nhất (dedup noise + tiết kiệm storage).
   */
  async recordSnapshot(productId: string, input: SnapshotInput): Promise<boolean> {
    const latest = await this.prisma.priceSnapshot.findFirst({
      where: { productId },
      orderBy: { capturedAt: "desc" },
      select: { price: true, originalPrice: true }
    });

    if (latest) {
      const samePrice = Number(latest.price) === input.price;
      const sameOriginal = nullableNumber(latest.originalPrice) === (input.originalPrice ?? null);
      if (samePrice && sameOriginal) return false;
    }

    await this.prisma.priceSnapshot.create({
      data: {
        productId,
        price: new Prisma.Decimal(input.price),
        originalPrice: input.originalPrice != null ? new Prisma.Decimal(input.originalPrice) : null,
        currency: input.currency ?? "VND",
        source: input.source ?? null
      }
    });
    return true;
  }

  async computeIntel(productId: string): Promise<PriceIntel> {
    const rows = await this.prisma.priceSnapshot.findMany({
      where: { productId },
      orderBy: { capturedAt: "asc" },
      take: MAX_SNAPSHOTS_READ,
      select: { price: true, originalPrice: true, capturedAt: true }
    });
    const observations: PriceObservation[] = rows.map((r) => ({
      price: Number(r.price),
      originalPrice: nullableNumber(r.originalPrice),
      capturedAt: r.capturedAt
    }));
    return classifyPrice(observations);
  }

  /**
   * Capture snapshot + recompute và persist `Product.priceIntel`. Gọi từ ImportService sau upsert.
   * KHÔNG throw — fail thì log warn rồi tiếp tục (không vỡ crawl cycle).
   */
  async captureAndRefresh(productId: string, input: SnapshotInput): Promise<void> {
    try {
      await this.recordSnapshot(productId, input);
      const intel = await this.computeIntel(productId);
      await this.prisma.product.update({
        where: { id: productId },
        data: { priceIntel: intel as unknown as Prisma.InputJsonValue }
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[price-intel] product=${productId} fail: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async getHistory(productId: string, days = 90): Promise<PriceHistoryPoint[]> {
    const since = new Date(Date.now() - days * 24 * 3_600_000);
    const rows = await this.prisma.priceSnapshot.findMany({
      where: { productId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
      select: { price: true, originalPrice: true, capturedAt: true }
    });
    return rows.map((r) => ({
      capturedAt: r.capturedAt.toISOString(),
      price: Number(r.price),
      originalPrice: nullableNumber(r.originalPrice)
    }));
  }
}

function nullableNumber(value: Prisma.Decimal | null): number | null {
  return value != null ? Number(value) : null;
}
