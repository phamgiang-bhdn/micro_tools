import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { ScraperService } from "../../services/scraper.service";
import { CampaignSyncService } from "./campaign-sync.service";
import { CouponSyncScheduler } from "./coupon-sync.scheduler";
import { CouponSyncService } from "./coupon-sync.service";
import { TopProductsSyncScheduler } from "./top-products-sync.scheduler";
import { TopProductsSyncService } from "./top-products-sync.service";
import { AccesstradeClient } from "./clients/accesstrade.client";
import { LazadaAffiliateClient } from "./clients/lazada.client";
import { ShopeeAffiliateClient } from "./clients/shopee.client";
import { TiktokAffiliateClient } from "./clients/tiktok.client";
import { WebScrapeClient } from "./clients/web-scrape.client";
import { CrawlerController } from "./crawler.controller";
import { CrawlerScheduler } from "./crawler.scheduler";
import { CrawlerService } from "./crawler.service";
import { EnrichmentService } from "./enrichment.service";
import { ImportService } from "./import.service";
import { ProductDiscoveryService } from "./product-discovery.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CrawlerController],
  providers: [
    PrismaService,
    AiService,
    ScraperService,
    AccesstradeClient,
    ShopeeAffiliateClient,
    TiktokAffiliateClient,
    LazadaAffiliateClient,
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
    AccesstradeClient
  ]
})
export class CrawlerModule {}
