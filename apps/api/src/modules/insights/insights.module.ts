import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CrawlerModule } from "../crawler/crawler.module";
import { MoneyTrailService } from "./money-trail.service";
import { OrderProductsSyncService } from "./order-products-sync.service";
import { RealBestsellerService } from "./real-bestseller.service";

/**
 * Insights services (sau Refactor V3 — cắt các loop speculative):
 * - OrderProductsSync (reconciler hook) + RealBestseller (ranking đơn thật)
 * - MoneyTrail (doanh thu per channel)
 * Đã cắt: CommissionRank, KeywordRadar, Opportunity ("Cơ hội tuần"), TrackedLink, AdSpend/ROAS.
 */
@Module({
  imports: [CrawlerModule],
  providers: [
    PrismaService,
    OrderProductsSyncService,
    RealBestsellerService,
    MoneyTrailService
  ],
  exports: [OrderProductsSyncService, RealBestsellerService, MoneyTrailService]
})
export class InsightsModule {}
