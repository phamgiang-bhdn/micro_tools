import { Controller, Get, HttpException, HttpStatus, Logger, Param, Query } from "@nestjs/common";
import { PriceIntelligenceService } from "../crawler/price-intelligence.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;

/**
 * Public price-history cho chart trên product detail. Verdict + summary đã nằm trên
 * `Product.priceIntel` (trả qua /niches/:slug) → endpoint này chỉ phục vụ chuỗi điểm vẽ chart.
 */
@Controller("prices")
export class PriceController {
  private readonly logger = new Logger(PriceController.name);

  constructor(private readonly priceIntel: PriceIntelligenceService) {}

  @Get(":productId/history")
  async getHistory(@Param("productId") productId: string, @Query("days") days?: string) {
    if (!UUID_RE.test(productId)) {
      return { productId, days: DEFAULT_DAYS, points: [] };
    }
    const parsed = Number(days);
    const window =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), MAX_DAYS) : DEFAULT_DAYS;
    try {
      const points = await this.priceIntel.getHistory(productId, window);
      return { productId, days: window, points };
    } catch (error: unknown) {
      this.logger.error(
        `Failed price history productId=${productId}`,
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException("Failed to fetch price history", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
