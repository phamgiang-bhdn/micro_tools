import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CrawlerModule } from "../crawler/crawler.module";
import { CommissionRankService } from "./commission-rank.service";
import { KeywordRadarService } from "./keyword-radar.service";
import { MoneyTrailService } from "./money-trail.service";
import { OpportunityService } from "./opportunity.service";
import { OrderProductsSyncService } from "./order-products-sync.service";
import { RealBestsellerService } from "./real-bestseller.service";
import { TrackedLinkService } from "./tracked-link.service";

/**
 * 6 money loop services (at-money-flows-v1):
 * - Loop 1: CommissionRank + KeywordRadar + Opportunity (cross-ref)
 * - Loop 2: OrderProductsSync (reconciler hook) + RealBestseller (ranking)
 * - Loop 3: MoneyTrail (channel ROAS)
 * - Loop 4: coupon-inline pill — pure render-time, no service
 * - Loop 5: TrackedLink (AT product_link/create)
 * - Loop 6: defer
 */
@Module({
  imports: [CrawlerModule],
  providers: [
    PrismaService,
    CommissionRankService,
    KeywordRadarService,
    OpportunityService,
    OrderProductsSyncService,
    RealBestsellerService,
    MoneyTrailService,
    TrackedLinkService
  ],
  exports: [
    CommissionRankService,
    KeywordRadarService,
    OpportunityService,
    OrderProductsSyncService,
    RealBestsellerService,
    MoneyTrailService,
    TrackedLinkService
  ]
})
export class InsightsModule {}
