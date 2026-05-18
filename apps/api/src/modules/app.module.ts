import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../services/ai.service";
import { ArticleService } from "../services/article.service";
import { ScraperService } from "../services/scraper.service";
import { AdminController } from "./admin/admin.controller";
import { ArticlesController } from "./articles/articles.controller";
import { NichesController } from "./niches/niches.controller";
import { CouponsController } from "./coupons/coupons.controller";
import { TopProductsController } from "./top-products/top-products.controller";
import { CrawlerModule } from "./crawler/crawler.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { TrackingController } from "./tracking/tracking.controller";
import { WebhooksController } from "./webhooks/webhooks.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    CrawlerModule,
    ReconciliationModule
  ],
  controllers: [
    WebhooksController,
    NichesController,
    TrackingController,
    ArticlesController,
    CouponsController,
    TopProductsController,
    AdminController
  ],
  providers: [PrismaService, ScraperService, AiService, ArticleService]
})
export class AppModule {}
