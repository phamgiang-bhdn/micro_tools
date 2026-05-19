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
        productIds: []
      },
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

    // Cho phép admin "force" retry bằng cách reset status về input status đầu của stage.
    const allowed = STAGE_INPUT_STATUS[stage];
    if (!allowed.includes(article.status)) {
      await this.prisma.article.update({
        where: { id: articleId },
        data: { status: allowed[0] }
      });
    }
    // Khi admin retry từ BRIEF/WRITER → reset aiRevisionCount để cho phép critic loop lại.
    if (stage === PipelineStageName.BRIEF_BUILDER || stage === PipelineStageName.WRITER) {
      await this.prisma.article.update({
        where: { id: articleId },
        data: { aiRevisionCount: 0 }
      });
    }
    // Mark stage start NGAY để UI thấy progress (status set bởi runner trong async).
    // Trước đó admin phải đợi sync — brief 77s → UI im 77s.
    await this.prisma.article.update({
      where: { id: articleId },
      data: { currentStageMessage: `Sắp chạy: ${stage}`, currentStageProgress: 0 }
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
