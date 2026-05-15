import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../services/ai.service";
import { ArticleService } from "../services/article.service";
import { ScraperService } from "../services/scraper.service";
import { AdminController } from "./admin/admin.controller";
import { ArticlesController } from "./articles/articles.controller";
import { CategoriesController } from "./categories/categories.controller";
import { CrawlerModule } from "./crawler/crawler.module";
import { TrackingController } from "./tracking/tracking.controller";
import { WebhooksController } from "./webhooks/webhooks.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    CrawlerModule
  ],
  controllers: [
    WebhooksController,
    CategoriesController,
    TrackingController,
    ArticlesController,
    AdminController
  ],
  providers: [PrismaService, ScraperService, AiService, ArticleService]
})
export class AppModule {}
