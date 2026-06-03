import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../services/ai.service";
import { ScraperService } from "../services/scraper.service";
import { AdminController } from "./admin/admin.controller";
import { ArticleNotificationService } from "./articles/article-notification.service";
import { ArticlesController } from "./articles/articles.controller";
import { NichesController } from "./niches/niches.controller";
import { CouponsController } from "./coupons/coupons.controller";
import { TopProductsController } from "./top-products/top-products.controller";
import { SubscribersController } from "./subscribers/subscribers.controller";
import { ArticlePipelineModule } from "./article-pipeline/article-pipeline.module";
import { CrawlerModule } from "./crawler/crawler.module";
import { InsightsModule } from "./insights/insights.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { RefineryModule } from "./refinery/refinery.module";
import { ToolModule } from "./tool/tool.module";
import { TrackingController } from "./tracking/tracking.controller";
import { WaitlistController } from "./waitlist/waitlist.controller";
import { WebhooksController } from "./webhooks/webhooks.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    RefineryModule,
    CrawlerModule,
    InsightsModule,
    ReconciliationModule,
    ArticlePipelineModule,
    ToolModule
  ],
  controllers: [
    WebhooksController,
    NichesController,
    TrackingController,
    ArticlesController,
    CouponsController,
    TopProductsController,
    SubscribersController,
    WaitlistController,
    AdminController
  ],
  providers: [PrismaService, ScraperService, AiService, ArticleNotificationService]
})
export class AppModule {}
