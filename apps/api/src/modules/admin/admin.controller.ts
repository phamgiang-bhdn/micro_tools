import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query
} from "@nestjs/common";
import { ArticleStatus, ArticleType, ParseStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { AiService } from "../../services/ai.service";
import { ArticleService } from "../../services/article.service";
import { PrismaService } from "../../prisma/prisma.service";

const promptTestSchema = z.object({
  prompt: z.string().min(10),
  sampleText: z.string().min(10),
  schemaConfig: z.record(z.unknown())
});

const promptSaveSchema = z.object({
  name: z.string().min(2),
  content: z.string().min(10),
  createdBy: z.string().optional(),
  activateNow: z.boolean().optional()
});

const generateArticleSchema = z.object({
  type: z.nativeEnum(ArticleType),
  topic: z.string().min(5).max(300),
  toolId: z.string().uuid().nullable().optional(),
  productIds: z.array(z.string().uuid()).max(20).optional()
});

const updateArticleSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  excerpt: z.string().max(300).nullable().optional(),
  body: z.string().min(50).optional(),
  metaTitle: z.string().max(120).nullable().optional(),
  metaDescription: z.string().max(300).nullable().optional(),
  toolId: z.string().uuid().nullable().optional(),
  productIds: z.array(z.string().uuid()).max(20).optional(),
  type: z.nativeEnum(ArticleType).optional()
});

@Controller("admin")
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly articleService: ArticleService
  ) {}

  private authorize(
    role: string | undefined,
    apiKey: string | undefined,
    allowed: Array<"viewer" | "reviewer" | "admin">
  ): void {
    const normalizedRole = (role ?? "viewer").toLowerCase() as "viewer" | "reviewer" | "admin";
    const expectedKey = process.env.ADMIN_API_KEY ?? "change-me";
    if (!apiKey || apiKey !== expectedKey) {
      throw new HttpException("Unauthorized admin API key", HttpStatus.UNAUTHORIZED);
    }
    if (!allowed.includes(normalizedRole)) {
      throw new HttpException("Insufficient admin role", HttpStatus.FORBIDDEN);
    }
  }

  @Get("war-room")
  async getWarRoom(@Headers("x-admin-role") role?: string, @Headers("x-admin-key") apiKey?: string) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    try {
      const [monthlyRevenue, totalClicks, successfulConversions, pendingReview, crawlerHeartbeat] = await Promise.all([
        this.prisma.conversionWebhook.aggregate({
          _sum: { revenue: true },
          where: { receivedAt: { gte: monthStart } }
        }),
        this.prisma.clickLog.count(),
        this.prisma.conversionWebhook.count({
          where: { status: { in: ["approved", "success"] } }
        }),
        this.prisma.productExtraction.count({
          where: { status: "PENDING_REVIEW" }
        }),
        this.prisma.productExtraction.count({
          where: {
            createdAt: { gte: dayStart }
          }
        })
      ]);

      const revenue = monthlyRevenue._sum.revenue ?? new Prisma.Decimal(0);
      const conversionRate = totalClicks > 0 ? (successfulConversions / totalClicks) * 100 : 0;

      return {
        monthlyRevenue: revenue.toString(),
        totalClicks,
        successfulConversions,
        conversionRate: Number(conversionRate.toFixed(2)),
        pendingReview,
        tokenBalanceEstimate: 100000 - pendingReview * 150,
        crawlerHealthy: crawlerHeartbeat > 0
      };
    } catch (error: unknown) {
      this.logger.error("Failed to build war-room metrics", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Unable to load war-room data", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get("refinery")
  async getRefineryQueue(
    @Query("status") status?: ParseStatus,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const filterStatus = status && Object.values(ParseStatus).includes(status) ? status : "PENDING_REVIEW";
    return this.prisma.productExtraction.findMany({
      where: { status: filterStatus },
      include: {
        product: {
          select: { id: true, name: true, network: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  @Get("refinery/:id")
  async getRefineryItem(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const extraction = await this.prisma.productExtraction.findUnique({
      where: { id },
      include: {
        product: {
          include: { tool: { select: { name: true, slug: true } } }
        }
      }
    });
    if (!extraction) {
      throw new HttpException("Extraction not found", HttpStatus.NOT_FOUND);
    }
    return extraction;
  }

  @Post("refinery/:id/approve")
  async approveExtraction(
    @Param("id") id: string,
    @Body() body: { aiOutput: Record<string, unknown>; reviewer: string },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    if (!body.aiOutput || typeof body.aiOutput !== "object") {
      throw new HttpException("aiOutput is required", HttpStatus.BAD_REQUEST);
    }

    const extraction = await this.prisma.productExtraction.update({
      where: { id },
      data: {
        aiOutput: body.aiOutput as Prisma.InputJsonValue,
        status: "PUBLISHED",
        reviewedBy: body.reviewer || "admin",
        reviewedAt: new Date()
      }
    });

    await this.prisma.product.update({
      where: { id: extraction.productId },
      data: {
        scrapedData: body.aiOutput as Prisma.InputJsonValue
      }
    });

    return { success: true };
  }

  @Post("refinery/:id/reject")
  async rejectExtraction(
    @Param("id") id: string,
    @Body() body: { reason?: string; reviewer?: string },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    await this.prisma.productExtraction.update({
      where: { id },
      data: {
        status: "ERROR",
        errorReason: body.reason ?? "Rejected by reviewer",
        reviewedBy: body.reviewer ?? "admin",
        reviewedAt: new Date()
      }
    });
    return { success: true };
  }

  @Post("refinery/:id/retry")
  async retryExtraction(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const extraction = await this.prisma.productExtraction.findUnique({
      where: { id },
      include: { product: { include: { tool: true } } }
    });
    if (!extraction) {
      throw new HttpException("Extraction not found", HttpStatus.NOT_FOUND);
    }

    const schema = extraction.product.tool.schemaConfig as Record<string, unknown>;
    const aiOutput = await this.aiService.parseBySchema<Record<string, unknown>>(extraction.rawContent, schema);

    await this.prisma.productExtraction.update({
      where: { id },
      data: {
        aiOutput: aiOutput as Prisma.InputJsonValue,
        status: "PENDING_REVIEW",
        errorReason: null
      }
    });

    return { success: true };
  }

  @Get("prompts/active")
  async getActivePrompt(@Headers("x-admin-role") role?: string, @Headers("x-admin-key") apiKey?: string) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.prisma.promptTemplate.findFirst({
      where: { isActive: true },
      orderBy: { activatedAt: "desc" }
    });
  }

  @Post("prompts/test")
  async testPrompt(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = promptTestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }

    const aiResult = await this.aiService.parseBySchema<Record<string, unknown>>(
      `${parsed.data.prompt}\n\n${parsed.data.sampleText}`,
      parsed.data.schemaConfig
    );

    return { result: aiResult };
  }

  @Post("prompts/save")
  async savePrompt(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = promptSaveSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }

    if (parsed.data.activateNow) {
      await this.prisma.promptTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }

    const latest = await this.prisma.promptTemplate.findFirst({
      where: { name: parsed.data.name },
      orderBy: { version: "desc" }
    });

    const created = await this.prisma.promptTemplate.create({
      data: {
        name: parsed.data.name,
        content: parsed.data.content,
        createdBy: parsed.data.createdBy,
        version: (latest?.version ?? 0) + 1,
        isActive: Boolean(parsed.data.activateNow),
        activatedAt: parsed.data.activateNow ? new Date() : null
      }
    });

    return created;
  }

  @Get("money-trail")
  async getMoneyTrail(
    @Query("limit") limit = "100",
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const parsedLimit = Math.min(Math.max(Number(limit), 1), 500);
    return this.prisma.clickLog.findMany({
      include: {
        product: {
          select: { name: true, network: true }
        },
        conversionHooks: {
          select: { revenue: true, status: true, receivedAt: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parsedLimit
    });
  }

  // ───── Articles ─────

  @Get("articles")
  async listArticles(
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.ArticleWhereInput = {};
    if (status && (Object.values(ArticleStatus) as string[]).includes(status)) {
      where.status = status as ArticleStatus;
    }
    if (type && (Object.values(ArticleType) as string[]).includes(type)) {
      where.type = type as ArticleType;
    }
    return this.prisma.article.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        status: true,
        updatedAt: true,
        publishedAt: true,
        tool: { select: { slug: true, name: true } }
      }
    });
  }

  @Get("articles/:id")
  async getArticle(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { tool: { select: { id: true, slug: true, name: true } } }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);

    const products =
      article.productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: article.productIds } },
            select: { id: true, name: true, slug: true, network: true }
          })
        : [];

    return { ...article, products };
  }

  @Post("articles/generate")
  async generateArticle(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = generateArticleSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }

    const { output, promptName, modelName } = await this.articleService.generateDraft({
      type: parsed.data.type,
      topic: parsed.data.topic,
      toolId: parsed.data.toolId ?? null,
      productIds: parsed.data.productIds ?? []
    });

    const uniqueSlug = await this.articleService.ensureUniqueSlug(output.slug);

    const article = await this.prisma.article.create({
      data: {
        slug: uniqueSlug,
        title: output.title,
        excerpt: output.excerpt,
        body: output.body,
        type: parsed.data.type,
        status: "DRAFT",
        toolId: parsed.data.toolId ?? null,
        productIds: parsed.data.productIds ?? [],
        metaTitle: output.metaTitle || null,
        metaDescription: output.metaDescription || null,
        aiModel: modelName,
        aiPromptName: promptName
      }
    });

    return article;
  }

  @Put("articles/:id")
  async updateArticle(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = updateArticleSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }

    const data: Prisma.ArticleUpdateInput = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.body !== undefined) data.body = parsed.data.body;
    if (parsed.data.excerpt !== undefined) data.excerpt = parsed.data.excerpt;
    if (parsed.data.metaTitle !== undefined) data.metaTitle = parsed.data.metaTitle;
    if (parsed.data.metaDescription !== undefined) data.metaDescription = parsed.data.metaDescription;
    if (parsed.data.type !== undefined) data.type = parsed.data.type;
    if (parsed.data.productIds !== undefined) data.productIds = { set: parsed.data.productIds };
    if (parsed.data.toolId !== undefined) {
      data.tool = parsed.data.toolId ? { connect: { id: parsed.data.toolId } } : { disconnect: true };
    }
    if (parsed.data.slug !== undefined) {
      data.slug = await this.articleService.ensureUniqueSlug(parsed.data.slug, id);
    }

    return this.prisma.article.update({ where: { id }, data });
  }

  @Post("articles/:id/publish")
  async publishArticle(
    @Param("id") id: string,
    @Body() body: { reviewer?: string },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    return this.prisma.article.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        reviewedBy: body?.reviewer || "admin",
        reviewedAt: new Date()
      }
    });
  }

  @Post("articles/:id/archive")
  async archiveArticle(
    @Param("id") id: string,
    @Body() body: { reviewer?: string },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    return this.prisma.article.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        reviewedBy: body?.reviewer || "admin",
        reviewedAt: new Date()
      }
    });
  }
}
