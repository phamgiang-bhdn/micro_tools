import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PipelineStage,
  PipelineStageName,
  STAGE_INPUT_STATUS,
  STAGE_SUCCESS_STATUS,
  STATUS_TO_STAGE,
  StageContext
} from "./pipeline.types";
import { BriefBuilderStage } from "./stages/brief-builder.stage";
import { ResearchStage } from "./stages/research.stage";
import { ReviewScraperStage } from "./stages/review-scraper.stage";
import { OutlineStage } from "./stages/outline.stage";
import { ImageStage } from "./stages/image.stage";
import { WriterStage } from "./stages/writer.stage";
import { CriticStage } from "./stages/critic.stage";
import { FactCheckStage } from "./stages/fact-check.stage";

const TERMINAL_STATUSES: ArticleStatus[] = [
  ArticleStatus.PENDING_REVIEW,
  ArticleStatus.NEEDS_REVISION,
  ArticleStatus.FAILED,
  ArticleStatus.PUBLISHED,
  ArticleStatus.ARCHIVED
];

@Injectable()
export class PipelineRunner {
  private readonly logger = new Logger(PipelineRunner.name);
  private readonly stages: Map<PipelineStageName, PipelineStage>;

  constructor(
    private readonly prisma: PrismaService,
    briefBuilder: BriefBuilderStage,
    research: ResearchStage,
    reviewScraper: ReviewScraperStage,
    outline: OutlineStage,
    image: ImageStage,
    writer: WriterStage,
    critic: CriticStage,
    factCheck: FactCheckStage
  ) {
    this.stages = new Map<PipelineStageName, PipelineStage>([
      [PipelineStageName.BRIEF_BUILDER, briefBuilder],
      [PipelineStageName.RESEARCH, research],
      [PipelineStageName.REVIEW_SCRAPER, reviewScraper],
      [PipelineStageName.OUTLINE, outline],
      [PipelineStageName.IMAGE, image],
      [PipelineStageName.WRITER, writer],
      [PipelineStageName.CRITIC, critic],
      [PipelineStageName.FACT_CHECK, factCheck]
    ]);
  }

  /** Chạy 1 stage cụ thể. Validate status hiện tại có hợp lệ làm input của stage. */
  async runStage(stageName: PipelineStageName, ctx: StageContext): Promise<void> {
    const stage = this.stages.get(stageName);
    if (!stage) {
      throw new HttpException(`Unknown stage: ${stageName}`, HttpStatus.BAD_REQUEST);
    }

    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      select: { id: true, status: true, type: true }
    });
    if (!article) {
      throw new HttpException("Article not found", HttpStatus.NOT_FOUND);
    }

    const allowed = STAGE_INPUT_STATUS[stageName];
    if (!allowed.includes(article.status)) {
      throw new HttpException(
        `Stage ${stageName} không thể chạy ở status ${article.status} (allowed: ${allowed.join(", ")})`,
        HttpStatus.CONFLICT
      );
    }

    const startedAt = Date.now();
    this.logger.log(`▶ Stage ${stageName} START article=${ctx.articleId} agent=${stage.agent}`);
    const run = await this.prisma.articleGenerationRun.create({
      data: {
        articleId: ctx.articleId,
        stage: stageName,
        agent: stage.agent,
        startedAt: new Date(),
        success: false
      }
    });

    // Báo cho admin UI: stage đang chạy.
    await this.prisma.article.update({
      where: { id: ctx.articleId },
      data: {
        currentStageMessage: `Đang chạy bước "${stageName}"…`,
        currentStageProgress: 0
      }
    });

    const reportProgress = async (message: string, percent?: number) => {
      this.logger.log(
        `  · ${stageName}${typeof percent === "number" ? ` ${percent}%` : ""}: ${message}`
      );
      try {
        await this.prisma.article.update({
          where: { id: ctx.articleId },
          data: {
            currentStageMessage: message.slice(0, 240),
            ...(typeof percent === "number"
              ? { currentStageProgress: Math.max(0, Math.min(100, Math.round(percent))) }
              : {})
          }
        });
      } catch (err) {
        // Không để progress update làm fail stage.
        this.logger.debug(`reportProgress failed: ${(err as Error).message}`);
      }
    };

    const ctxWithProgress: StageContext = { ...ctx, reportProgress };

    try {
      const result = await stage.run(ctxWithProgress);
      const durationMs = Date.now() - startedAt;
      const nextStatus = result.loopBackTo
        ? STAGE_INPUT_STATUS[result.loopBackTo][0]
        : result.nextStatus;

      // Optimistic lock: chỉ update nếu status vẫn match expected input. Tránh race khi
      // 2 admin bấm cùng lúc hoặc background pipeline đè kết quả admin retry.
      const inputStatus = article.status;
      const summaryJson = result.outputSummary as Prisma.InputJsonValue;
      const [, updated] = await this.prisma.$transaction([
        this.prisma.articleGenerationRun.update({
          where: { id: run.id },
          data: {
            success: true,
            durationMs,
            finishedAt: new Date(),
            outputSize: JSON.stringify(result.outputSummary).length,
            output: summaryJson
          }
        }),
        this.prisma.article.updateMany({
          where: { id: ctx.articleId, status: inputStatus },
          data: {
            status: nextStatus,
            generationError: null,
            currentStageMessage: null,
            currentStageProgress: null
          }
        })
      ]);

      if (updated.count === 0) {
        this.logger.warn(
          `Stage ${stageName} race detected article=${ctx.articleId}: status đã đổi khác ${inputStatus} trước khi commit. Bỏ qua chuyển status.`
        );
      } else {
        this.logger.log(
          `Stage ${stageName} OK article=${ctx.articleId} duration=${durationMs}ms next=${nextStatus}`
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;
      await this.prisma.$transaction([
        this.prisma.articleGenerationRun.update({
          where: { id: run.id },
          data: {
            success: false,
            errorReason: message.slice(0, 1000),
            durationMs,
            finishedAt: new Date()
          }
        }),
        this.prisma.article.update({
          where: { id: ctx.articleId },
          data: {
            status: ArticleStatus.FAILED,
            generationError: message.slice(0, 1000),
            currentStageMessage: null,
            currentStageProgress: null
          }
        })
      ]);
      this.logger.error(
        `Stage ${stageName} FAIL article=${ctx.articleId}: ${message}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new HttpException(`Stage ${stageName} failed: ${message}`, HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Chạy tuần tự từ stage hiện tại tới PENDING_REVIEW (hoặc fail / needs-revision).
   * Dùng cho fire-and-forget khi admin bấm "Generate".
   *
   * Lấy stage tiếp theo từ `STATUS_TO_STAGE[currentStatus]` → xử lý đúng case Critic loop-back:
   * critic set status = DRAFTING → vòng lặp kế tiếp tự pick WRITER chạy lại.
   */
  async runUntilHitl(ctx: StageContext): Promise<void> {
    const maxIterations = 30;
    for (let i = 0; i < maxIterations; i += 1) {
      const article = await this.prisma.article.findUnique({
        where: { id: ctx.articleId },
        select: { status: true }
      });
      if (!article) return;
      if (TERMINAL_STATUSES.includes(article.status)) return;

      const stage = STATUS_TO_STAGE[article.status];
      if (!stage) {
        this.logger.warn(`Pipeline halted: không có stage cho status ${article.status}`);
        return;
      }

      try {
        await this.runStage(stage, ctx);
      } catch (e) {
        this.logger.warn(`Pipeline halted at ${stage}: ${(e as Error).message}`);
        return;
      }
    }
    this.logger.warn(`Pipeline reached max iterations (${maxIterations}) — có thể đang loop vô tận`);
  }
}
