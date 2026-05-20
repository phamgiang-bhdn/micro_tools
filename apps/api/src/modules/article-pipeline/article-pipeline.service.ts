import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, ArticleType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PipelineRunner } from "./pipeline.runner";
import { PipelineStageName, STAGE_INPUT_STATUS } from "./pipeline.types";

export interface CreateArticleV2Input {
  type: ArticleType;
  topic: string;
  nicheId?: string | null;
  productRef?: string | null;
  pinnedProductIds?: string[];
  /** Khi true: pipeline dừng sau OUTLINE (status=IMAGES_READY) để admin duyệt outline trước
   * khi tốn ~5-10 phút Writer chạy. Admin bấm "Tiếp tục viết bài" → flag = false + chạy tiếp. */
  pauseAtOutline?: boolean;
}

/**
 * Public façade cho article V2 pipeline. AdminController gọi service này (không gọi runner trực tiếp).
 * Trách nhiệm:
 *  - Tạo Article row khởi đầu (status=DRAFT_BRIEF).
 *  - Trigger pipeline (fire-and-forget cho admin endpoint).
 *  - Cho phép admin retry stage lẻ.
 *  - Approve / reject ở HITL gate.
 */
@Injectable()
export class ArticlePipelineService {
  private readonly logger = new Logger(ArticlePipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: PipelineRunner
  ) {}

  /** Tạo Article row trạng thái DRAFT_BRIEF + trigger pipeline async. */
  async createAndStart(input: CreateArticleV2Input): Promise<{ id: string }> {
    const slug = await this.uniqueSlugFromTopic(input.topic);
    const article = await this.prisma.article.create({
      data: {
        slug,
        title: input.topic.slice(0, 200),
        body: "",
        type: input.type,
        status: ArticleStatus.DRAFT_BRIEF,
        nicheId: input.nicheId ?? null,
        topic: input.topic,
        productRef: input.productRef ?? null,
        pinnedProductIds: input.pinnedProductIds ?? [],
        productIds: [],
        ...(input.pauseAtOutline ? { pauseAtOutline: true } : {})
      } as Prisma.ArticleUncheckedCreateInput,
      select: { id: true }
    });

    // Fire-and-forget. Stage runner persist run logs + transition status.
    void this.runner
      .runUntilHitl({
        articleId: article.id,
        type: input.type,
        initialInput: {
          topic: input.topic,
          nicheId: input.nicheId ?? null,
          productRef: input.productRef ?? null,
          pinnedProductIds: input.pinnedProductIds
        }
      })
      .catch((err) => this.logger.error(`Pipeline async failure: ${(err as Error).message}`));

    return { id: article.id };
  }

  /** Retry 1 stage cụ thể. Admin endpoint dùng khi stage fail hoặc cần regenerate. */
  async retryStage(articleId: string, stage: PipelineStageName): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, type: true, status: true }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);

    // LUÔN reset status về input đầu của stage (kể cả khi status hiện tại đã hợp lệ).
    // Lý do: nếu status đang FAILED và allowed includes FAILED, status không đổi → UI vẫn
    // thấy terminal "FAILED" → hiển thị FailedBanner thay vì progress, dù stage đang chạy
    // ngầm. Reset về DRAFT_BRIEF/DRAFTING/... ngay để UI nhảy vào trạng thái running.
    const allowed = STAGE_INPUT_STATUS[stage];
    const targetStatus = allowed.find((s) => s !== ArticleStatus.FAILED && s !== ArticleStatus.NEEDS_REVISION) ?? allowed[0];

    // Đồng thời: clear generationError + set stageStartedAt để UI thấy elapsed ngay.
    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: targetStatus,
        generationError: null,
        currentStageMessage: `Sắp chạy: ${stage}`,
        currentStageProgress: 0,
        currentStageStartedAt: new Date(),
        // Khi admin retry từ BRIEF/WRITER → reset aiRevisionCount để cho phép critic loop lại.
        ...(stage === PipelineStageName.BRIEF_BUILDER || stage === PipelineStageName.WRITER
          ? { aiRevisionCount: 0 }
          : {})
      }
    });
    // Fire-and-forget: chạy stage rồi continue tới HITL nếu vẫn non-terminal.
    // Admin polling sẽ thấy progress live thay vì đợi response 1-2 phút.
    void (async () => {
      try {
        await this.runner.runStage(stage, { articleId, type: article.type });
        const after = await this.prisma.article.findUnique({
          where: { id: articleId },
          select: { status: true }
        });
        const terminal: ArticleStatus[] = [
          ArticleStatus.PENDING_REVIEW,
          ArticleStatus.NEEDS_REVISION,
          ArticleStatus.FAILED,
          ArticleStatus.PUBLISHED,
          ArticleStatus.ARCHIVED
        ];
        if (after && !terminal.includes(after.status)) {
          await this.runner.runUntilHitl({ articleId, type: article.type });
        }
      } catch (err) {
        this.logger.error(`Retry-stage pipeline failed: ${(err as Error).message}`);
      }
    })();
  }

  /**
   * Admin bấm "Tiếp tục viết bài" sau khi đã review outline (khi pauseAtOutline=true ban đầu).
   * Set flag false + trigger runUntilHitl từ status hiện tại (thường IMAGES_READY).
   */
  async continuePipeline(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, type: true, status: true }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);

    await this.prisma.article.update({
      where: { id: articleId },
      data: { pauseAtOutline: false } as Prisma.ArticleUncheckedUpdateInput
    });

    void this.runner
      .runUntilHitl({ articleId, type: article.type })
      .catch((err) => this.logger.error(`Continue pipeline failed: ${(err as Error).message}`));
  }

  /**
   * Admin yêu cầu refresh evidence: xoá FACT/PRICE/NEWS/REVIEW/SPEC cũ (giữ IMAGE để khỏi mất ảnh đã gắn),
   * rồi chạy lại Research stage. Hoạt động ở mọi status (kể cả PUBLISHED) — temp-shift status
   * sang RESEARCHING, chạy stage, rồi restore status gốc nếu cần (PUBLISHED hoặc terminal khác).
   * Section.evidenceRefs trỏ đến evidence đã xoá sẽ tự bị Writer filter ra (findMany trả []).
   */
  async refreshEvidence(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, type: true, status: true }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);

    const originalStatus = article.status;
    const wasPublished = originalStatus === ArticleStatus.PUBLISHED;

    await this.prisma.articleEvidence.deleteMany({
      where: { articleId, type: { in: ["FACT", "PRICE", "NEWS", "REVIEW", "SPEC"] } }
    });

    // Temp-shift để runStage(research) qua được STAGE_INPUT_STATUS check.
    await this.prisma.article.update({
      where: { id: articleId },
      data: { status: ArticleStatus.RESEARCHING }
    });

    void (async () => {
      try {
        await this.runner.runStage(PipelineStageName.RESEARCH, {
          articleId,
          type: article.type
        });
        // Nếu PUBLISHED → restore PUBLISHED (research thành công sẽ chuyển sang REVIEWS_SCRAPED,
        // không phù hợp cho article đã live). evidenceFreshAt đã được Research set.
        if (wasPublished) {
          await this.prisma.article.update({
            where: { id: articleId },
            data: { status: ArticleStatus.PUBLISHED }
          });
        }
      } catch (err) {
        this.logger.error(`Refresh-evidence failed: ${(err as Error).message}`);
        // Restore status gốc khi research fail.
        await this.prisma.article.update({
          where: { id: articleId },
          data: { status: originalStatus, currentStageMessage: null, currentStageProgress: null, currentStageStartedAt: null }
        });
      }
    })();
  }

  /** Admin approve ở HITL gate → PUBLISHED. Chỉ cho phép từ PENDING_REVIEW. */
  async approve(articleId: string, reviewedBy: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { status: true }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);
    if (article.status !== ArticleStatus.PENDING_REVIEW) {
      throw new HttpException(
        `Article phải ở PENDING_REVIEW mới được approve (hiện: ${article.status})`,
        HttpStatus.CONFLICT
      );
    }
    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        reviewedBy,
        reviewedAt: new Date(),
        currentStageMessage: null,
        currentStageProgress: null
      }
    });
  }

  /** Admin request revision → NEEDS_REVISION (HITL takeover). */
  async requestRevision(articleId: string, reason: string, reviewedBy: string): Promise<void> {
    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: ArticleStatus.NEEDS_REVISION,
        generationError: reason.slice(0, 1000),
        reviewedBy,
        reviewedAt: new Date(),
        currentStageMessage: null,
        currentStageProgress: null
      }
    });
  }

  /** Update body (markdown fallback) sau Writer hoàn thành — dùng để storefront có content render khi blocks empty. */
  async refreshBodyFromSections(articleId: string): Promise<void> {
    const sections = await this.prisma.articleSection.findMany({
      where: { articleId },
      orderBy: { order: "asc" }
    });
    const body = sections
      .map((s) => `## ${s.heading}\n\n${s.summary}\n\n${renderBlocksMarkdown(s.blocks)}`)
      .join("\n\n");
    await this.prisma.article.update({ where: { id: articleId }, data: { body } });
  }

  private async uniqueSlugFromTopic(topic: string): Promise<string> {
    const base = slugify(topic).slice(0, 80) || `article-${Date.now().toString(36)}`;
    let candidate = base;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.article.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      suffix += 1;
      candidate = `${base}-${suffix}`;
      if (suffix > 50) return `${base}-${Date.now().toString(36)}`;
    }
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderBlocksMarkdown(blocks: Prisma.JsonValue): string {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const block = b as Record<string, unknown>;
    if (block.type === "prose" && typeof block.markdown === "string") parts.push(block.markdown);
  }
  return parts.join("\n\n");
}
