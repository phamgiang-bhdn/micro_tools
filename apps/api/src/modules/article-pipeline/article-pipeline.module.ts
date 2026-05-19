import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { ArticlePipelineService } from "./article-pipeline.service";
import { ArticleRefreshService } from "./article-refresh.service";
import { PipelineRunner } from "./pipeline.runner";
import { BriefBuilderStage } from "./stages/brief-builder.stage";
import { ResearchStage } from "./stages/research.stage";
import { ReviewScraperStage } from "./stages/review-scraper.stage";
import { OutlineStage } from "./stages/outline.stage";
import { ImageStage } from "./stages/image.stage";
import { WriterStage } from "./stages/writer.stage";
import { CriticStage } from "./stages/critic.stage";
import { FactCheckStage } from "./stages/fact-check.stage";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    PrismaService,
    AiService,
    PipelineRunner,
    ArticlePipelineService,
    ArticleRefreshService,
    BriefBuilderStage,
    ResearchStage,
    ReviewScraperStage,
    OutlineStage,
    ImageStage,
    WriterStage,
    CriticStage,
    FactCheckStage
  ],
  exports: [ArticlePipelineService]
})
export class ArticlePipelineModule {}
