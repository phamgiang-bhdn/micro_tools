import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { ScraperService } from "../../services/scraper.service";
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
    CrawlerService,
    CrawlerScheduler
  ],
  exports: [ProductDiscoveryService]
})
export class CrawlerModule {}
