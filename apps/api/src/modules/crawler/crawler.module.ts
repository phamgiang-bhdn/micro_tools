import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { ScraperService } from "../../services/scraper.service";
import { SyncStatusService } from "../../services/sync-status.service";
import { RefineryModule } from "../refinery/refinery.module";
import { CampaignSyncService } from "./campaign-sync.service";
import { CouponSyncScheduler } from "./coupon-sync.scheduler";
import { CouponSyncService } from "./coupon-sync.service";
import { TopProductsSyncScheduler } from "./top-products-sync.scheduler";
import { TopProductsSyncService } from "./top-products-sync.service";
import { AccesstradeClient } from "./clients/accesstrade.client";
import { WebScrapeClient } from "./clients/web-scrape.client";
import { CrawlerController } from "./crawler.controller";
import { CrawlerScheduler } from "./crawler.scheduler";
import { CrawlerService } from "./crawler.service";
import { EnrichmentService } from "./enrichment.service";
import { ImportService } from "./import.service";
import { ProductDiscoveryService } from "./product-discovery.service";

@Module({
  imports: [ScheduleModule.forRoot(), RefineryModule],
  controllers: [CrawlerController],
  providers: [
    PrismaService,
    AiService,
    ScraperService,
    SyncStatusService,
    AccesstradeClient,
    WebScrapeClient,
    EnrichmentService,
    ImportService,
    ProductDiscoveryService,
    CampaignSyncService,
    CouponSyncService,
    CouponSyncScheduler,
    TopProductsSyncService,
    TopProductsSyncScheduler,
    CrawlerService,
    CrawlerScheduler
  ],
  exports: [
    ProductDiscoveryService,
    CampaignSyncService,
    CouponSyncService,
    TopProductsSyncService,
    AccesstradeClient,
    SyncStatusService,
    CrawlerService
  ]
})
export class CrawlerModule {}
