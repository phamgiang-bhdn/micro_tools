import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../services/ai.service";
import { ScraperService } from "../services/scraper.service";
import { AdminController } from "./admin/admin.controller";
import { ToolsController } from "./tools/tools.controller";
import { TrackingController } from "./tracking/tracking.controller";
import { WebhooksController } from "./webhooks/webhooks.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [WebhooksController, ToolsController, TrackingController, AdminController],
  providers: [PrismaService, ScraperService, AiService]
})
export class AppModule {}
