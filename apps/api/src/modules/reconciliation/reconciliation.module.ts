import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { CrawlerModule } from "../crawler/crawler.module";
import { InsightsModule } from "../insights/insights.module";
import { ReconciliationScheduler } from "./reconciliation.scheduler";
import { ReconciliationService } from "./reconciliation.service";

@Module({
  imports: [ScheduleModule.forRoot(), CrawlerModule, InsightsModule],
  providers: [PrismaService, ReconciliationService, ReconciliationScheduler],
  exports: [ReconciliationService]
})
export class ReconciliationModule {}
