import {
  Body,
  Controller,
  Delete,
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
import { AffiliateNetwork, ArticleStatus, ArticleType, CampaignStatus, CategoryStatus, ParseStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { AiService } from "../../services/ai.service";
import { ArticleService } from "../../services/article.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CampaignSyncService } from "../crawler/campaign-sync.service";
import { CouponSyncService } from "../crawler/coupon-sync.service";
import { DEFAULT_FILTER_RULES, filterRulesSchema } from "../crawler/dto/filter-rules.dto";
import { TopProductsSyncService } from "../crawler/top-products-sync.service";
import { ReconciliationService } from "../reconciliation/reconciliation.service";
import { uniqueSlugWithin } from "../../utils/slug.util";

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
  categoryId: z.string().uuid().nullable().optional(),
  pinnedProductIds: z.array(z.string().uuid()).max(10).optional(),
  productRef: z.string().min(1).max(500).nullable().optional()
});

const createCategorySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug chỉ chứa chữ thường, số, gạch ngang"),
  schemaConfig: z.record(z.unknown())
});

const updateCategorySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  status: z.nativeEnum(CategoryStatus).optional(),
  schemaConfig: z.record(z.unknown()).optional(),
  seoTitle: z.string().max(120).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional()
});

const createCouponSchema = z.object({
  code: z.string().min(2).max(40),
  description: z.string().max(300).optional().nullable(),
  discountPercent: z.number().int().min(1).max(100).optional().nullable(),
  discountAmount: z.number().nonnegative().optional().nullable(),
  network: z.nativeEnum(AffiliateNetwork).optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  affiliateUrl: z.string().url().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional()
});

const updateCouponSchema = createCouponSchema.partial();

const updateProductSchema = z.object({
  name: z.string().min(2).max(300).optional(),
  affiliateUrl: z.string().url().optional(),
  categoryId: z.string().uuid().optional(),
  network: z.nativeEnum(AffiliateNetwork).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  isPublic: z.boolean().optional(),
  scrapedData: z.record(z.unknown()).optional()
});

const createProductSchema = z.object({
  name: z.string().min(2).max(300),
  affiliateUrl: z.string().url(),
  categoryId: z.string().uuid(),
  network: z.nativeEnum(AffiliateNetwork),
  isPublic: z.boolean().optional(),
  scrapedData: z.record(z.unknown()).optional()
});

const createCampaignSchema = z.object({
  network: z.nativeEnum(AffiliateNetwork),
  externalId: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "externalId chỉ chứa chữ thường, số, gạch ngang"),
  name: z.string().min(1).max(200),
  merchantName: z.string().max(120).nullable().optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  appliedAt: z.string().datetime().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  commissionNote: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

const createAssignmentSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    newCategory: z
      .object({
        name: z.string().min(1).max(120),
        slug: z
          .string()
          .min(2)
          .max(80)
          .regex(/^[a-z0-9-]+$/, "slug chỉ chứa a-z, 0-9, dấu gạch ngang"),
        schemaConfig: z.record(z.string(), z.unknown())
      })
      .optional(),
    filterRules: filterRulesSchema,
    priority: z.number().int().min(0).max(10000).optional()
  })
  .refine((d) => Boolean(d.categoryId) !== Boolean(d.newCategory), {
    message: "Phải có đúng 1 trong: categoryId hoặc newCategory"
  });

const updateAssignmentSchema = z
  .object({
    filterRules: filterRulesSchema.optional(),
    priority: z.number().int().min(0).max(10000).optional()
  })
  .refine((d) => d.filterRules !== undefined || d.priority !== undefined, {
    message: "Cần ít nhất 1 trong: filterRules hoặc priority"
  });

const updateCampaignSchema = createCampaignSchema.partial().extend({
  network: z.nativeEnum(AffiliateNetwork).optional(),
  externalId: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional()
});

const bulkCategorySchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["activate", "deactivate", "delete"])
});

const bulkProductSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["make-public", "make-private", "delete"])
});

const bulkCampaignSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1),
    action: z.union([
      z.literal("status:APPROVED"),
      z.literal("status:PAUSED"),
      z.literal("status:REJECTED"),
      z.literal("status:INACTIVE"),
      z.literal("assign-category")
    ]),
    categoryId: z.string().uuid().optional()
  })
  .refine(
    (d) => d.action !== "assign-category" || Boolean(d.categoryId),
    { message: "categoryId là bắt buộc cho action assign-category" }
  );

const bulkCouponSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["approve", "archive", "activate", "deactivate", "delete"])
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
  categoryId: z.string().uuid().nullable().optional(),
  productIds: z.array(z.string().uuid()).max(20).optional(),
  type: z.nativeEnum(ArticleType).optional()
});

function redactSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, "[REDACTED_GEMINI_KEY]")
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[REDACTED_DB_URL]")
    .replace(/(api[-_]?key|x-admin-key|authorization)[":=\s]+[\w.-]+/gi, "$1: [REDACTED]");
}

@Controller("admin")
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly articleService: ArticleService,
    private readonly campaignSync: CampaignSyncService,
    private readonly reconciliation: ReconciliationService,
    private readonly couponSync: CouponSyncService,
    private readonly topProducts: TopProductsSyncService
  ) {}

  private authorize(
    role: string | undefined,
    apiKey: string | undefined,
    allowed: Array<"viewer" | "reviewer" | "admin">
  ): void {
    const normalizedRole = (role ?? "viewer").toLowerCase() as "viewer" | "reviewer" | "admin";
    const expectedKey = process.env.ADMIN_API_KEY ?? "change-me";
    if (process.env.NODE_ENV === "production" && expectedKey === "change-me") {
      throw new HttpException(
        "ADMIN_API_KEY is left at default in production — refusing all admin requests",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
          include: { category: { select: { name: true, slug: true } } }
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
        scrapedData: body.aiOutput as Prisma.InputJsonValue,
        isPublic: true
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
      include: { product: { include: { category: true } } }
    });
    if (!extraction) {
      throw new HttpException("Extraction not found", HttpStatus.NOT_FOUND);
    }

    const schema = extraction.product.category.schemaConfig as Record<string, unknown>;
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
    @Query("trackingCode") trackingCode?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("network") network?: string,
    @Query("mismatchOnly") mismatchOnly?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const parsedLimit = Math.min(Math.max(Number(limit), 1), 1000);
    const where: Prisma.ClickLogWhereInput = {};
    if (trackingCode) where.trackingCode = { contains: trackingCode };
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }
    if (network && (Object.values(AffiliateNetwork) as string[]).includes(network)) {
      where.product = { network: network as AffiliateNetwork };
    }
    if (mismatchOnly === "true") {
      where.conversionHooks = { some: { reconcileNotes: { not: null } } };
    }
    const rows = await this.prisma.clickLog.findMany({
      where,
      include: {
        product: { select: { name: true, network: true } },
        conversionHooks: {
          select: {
            revenue: true,
            status: true,
            receivedAt: true,
            network: true,
            source: true,
            atOrderId: true,
            atCommission: true,
            reconcileNotes: true,
            lastReconciledAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parsedLimit
    });
    return rows;
  }

  @Get("money-trail/summary")
  async getMoneyTrailSummary(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.ConversionWebhookWhereInput = {};
    if (from || to) {
      where.receivedAt = {};
      if (from) (where.receivedAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.receivedAt as Prisma.DateTimeFilter).lte = new Date(to);
    }
    const [total, byNetwork, count] = await Promise.all([
      this.prisma.conversionWebhook.aggregate({
        _sum: { revenue: true },
        where
      }),
      this.prisma.conversionWebhook.groupBy({
        by: ["network"],
        _sum: { revenue: true },
        _count: { _all: true },
        where
      }),
      this.prisma.conversionWebhook.count({ where })
    ]);
    return {
      totalRevenue: (total._sum.revenue ?? new Prisma.Decimal(0)).toString(),
      conversionCount: count,
      byNetwork: byNetwork.map((b) => ({
        network: b.network,
        revenue: (b._sum.revenue ?? new Prisma.Decimal(0)).toString(),
        count: b._count._all
      }))
    };
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
        category: { select: { slug: true, name: true } }
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
      include: { category: { select: { id: true, slug: true, name: true } } }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);

    const products =
      article.productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: article.productIds } },
            select: { id: true, name: true, slug: true, network: true, isPublic: true }
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
    if (parsed.data.type === ArticleType.BUYING_GUIDE && !parsed.data.categoryId) {
      throw new HttpException("BUYING_GUIDE bài cần chọn danh mục", HttpStatus.BAD_REQUEST);
    }
    if (parsed.data.type === ArticleType.REVIEW && !parsed.data.productRef) {
      throw new HttpException("REVIEW cần nhập tên / slug / URL sản phẩm", HttpStatus.BAD_REQUEST);
    }

    const placeholderSlug = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const article = await this.prisma.article.create({
      data: {
        slug: placeholderSlug,
        title: parsed.data.topic.slice(0, 120),
        body: "(đang sinh nội dung...)",
        type: parsed.data.type,
        status: "GENERATING",
        categoryId: parsed.data.categoryId ?? null,
        productIds: [],
        pinnedProductIds: parsed.data.pinnedProductIds ?? []
      }
    });

    // Fire-and-forget. Caller polls /admin/articles/:id for status transitions.
    setImmediate(() => {
      this.runArticleGeneration(article.id, parsed.data).catch((err) => {
        this.logger.error(`Background article generation crashed for ${article.id}`, err);
      });
    });

    return { id: article.id, status: article.status };
  }

  private async runArticleGeneration(
    articleId: string,
    input: z.infer<typeof generateArticleSchema>
  ): Promise<void> {
    try {
      const draft = await this.articleService.generateDraft({
        type: input.type,
        topic: input.topic,
        categoryId: input.categoryId ?? null,
        pinnedProductIds: input.pinnedProductIds ?? [],
        productRef: input.productRef ?? null
      });
      const uniqueSlug = await this.articleService.ensureUniqueSlug(draft.output.slug, articleId);

      await this.prisma.article.update({
        where: { id: articleId },
        data: {
          slug: uniqueSlug,
          title: draft.output.title,
          excerpt: draft.output.excerpt,
          body: draft.derivedBody,
          blocks: draft.output.blocks as Prisma.InputJsonValue,
          status: "DRAFT",
          productIds: draft.resolvedProductIds,
          coverImage: draft.coverImage,
          metaTitle: draft.output.metaTitle || null,
          metaDescription: draft.output.metaDescription || null,
          aiModel: draft.modelName,
          aiPromptName: draft.promptName,
          generationError: null
        }
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const redacted = redactSecrets(rawMessage);
      this.logger.error(`Article generation failed for ${articleId}: ${redacted}`);
      await this.prisma.article.update({
        where: { id: articleId },
        data: { status: "FAILED", generationError: redacted.slice(0, 1000) }
      });
    }
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
    if (parsed.data.categoryId !== undefined) {
      data.category = parsed.data.categoryId ? { connect: { id: parsed.data.categoryId } } : { disconnect: true };
    }
    if (parsed.data.slug !== undefined) {
      data.slug = await this.articleService.ensureUniqueSlug(parsed.data.slug, id);
    }

    return this.prisma.article.update({ where: { id }, data });
  }

  @Delete("articles/:id")
  async deleteArticle(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    await this.prisma.article.delete({ where: { id } });
    return { success: true };
  }

  @Post("articles/:id/duplicate")
  async duplicateArticle(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const src = await this.prisma.article.findUnique({ where: { id } });
    if (!src) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);
    const newSlug = await this.articleService.ensureUniqueSlug(`${src.slug}-copy`);
    return this.prisma.article.create({
      data: {
        slug: newSlug,
        title: `${src.title} (bản sao)`,
        excerpt: src.excerpt,
        body: src.body,
        blocks: src.blocks ?? Prisma.JsonNull,
        coverImage: src.coverImage,
        type: src.type,
        status: "DRAFT",
        categoryId: src.categoryId,
        productIds: src.productIds,
        pinnedProductIds: src.pinnedProductIds,
        metaTitle: src.metaTitle,
        metaDescription: src.metaDescription
      }
    });
  }

  @Post("articles/bulk")
  async bulkArticleAction(
    @Body() body: { ids: string[]; action: "publish" | "archive" | "delete"; reviewer?: string },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new HttpException("ids[] is required", HttpStatus.BAD_REQUEST);
    }
    const reviewer = body.reviewer ?? "admin";
    if (body.action === "delete") {
      await this.prisma.article.deleteMany({ where: { id: { in: body.ids } } });
      return { success: true, count: body.ids.length };
    }
    const status = body.action === "publish" ? ArticleStatus.PUBLISHED : ArticleStatus.ARCHIVED;
    const result = await this.prisma.article.updateMany({
      where: { id: { in: body.ids } },
      data: {
        status,
        reviewedBy: reviewer,
        reviewedAt: new Date(),
        publishedAt: status === ArticleStatus.PUBLISHED ? new Date() : undefined
      }
    });
    return { success: true, count: result.count };
  }

  @Post("articles/:id/schedule")
  async scheduleArticle(
    @Param("id") id: string,
    @Body() body: { scheduledAt: string | null },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new HttpException("Invalid scheduledAt", HttpStatus.BAD_REQUEST);
    }
    return this.prisma.article.update({ where: { id }, data: { scheduledAt } });
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

  // ───── Coupons ─────

  @Get("coupons")
  async listCoupons(
    @Query("isActive") isActive?: string,
    @Query("network") network?: string,
    @Query("merchantSlug") merchantSlug?: string,
    @Query("limit") limit?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.CouponWhereInput = {};
    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;
    if (network && (Object.values(AffiliateNetwork) as string[]).includes(network)) {
      where.network = network as AffiliateNetwork;
    }
    if (merchantSlug) where.merchantSlug = merchantSlug;
    return this.prisma.coupon.findMany({
      where,
      orderBy: [{ atLastSyncedAt: "desc" }, { createdAt: "desc" }],
      take: Math.min(Math.max(Number(limit ?? 200), 1), 500),
      include: {
        product: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } }
      }
    });
  }

  @Post("coupons/sync-from-at")
  async syncCouponsFromAt(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    try {
      return await this.couponSync.syncFromAccesstrade();
    } catch (error: unknown) {
      this.logger.error(
        "syncCouponsFromAt failed",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException(
        "Sync coupons failed — xem log server",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post("coupons/:id/approve")
  async approveCoupon(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    return this.prisma.coupon.update({ where: { id }, data: { isActive: true } });
  }

  @Post("coupons/:id/archive")
  async archiveCoupon(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    return this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
  }

  @Post("coupons")
  async createCoupon(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = createCouponSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const exists = await this.prisma.coupon.findUnique({ where: { code: parsed.data.code } });
    if (exists) throw new HttpException("Mã đã tồn tại", HttpStatus.CONFLICT);
    return this.prisma.coupon.create({
      data: {
        code: parsed.data.code,
        description: parsed.data.description ?? null,
        discountPercent: parsed.data.discountPercent ?? null,
        discountAmount:
          parsed.data.discountAmount != null ? new Prisma.Decimal(parsed.data.discountAmount) : null,
        network: parsed.data.network ?? null,
        productId: parsed.data.productId ?? null,
        categoryId: parsed.data.categoryId ?? null,
        affiliateUrl: parsed.data.affiliateUrl ?? null,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isActive: parsed.data.isActive ?? true
      }
    });
  }

  @Put("coupons/:id")
  async updateCoupon(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = updateCouponSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data: Prisma.CouponUpdateInput = {};
    if (parsed.data.code !== undefined) data.code = parsed.data.code;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.discountPercent !== undefined) data.discountPercent = parsed.data.discountPercent;
    if (parsed.data.discountAmount !== undefined) {
      data.discountAmount =
        parsed.data.discountAmount != null ? new Prisma.Decimal(parsed.data.discountAmount) : null;
    }
    if (parsed.data.network !== undefined) data.network = parsed.data.network;
    if (parsed.data.productId !== undefined) {
      data.product = parsed.data.productId
        ? { connect: { id: parsed.data.productId } }
        : { disconnect: true };
    }
    if (parsed.data.categoryId !== undefined) {
      data.category = parsed.data.categoryId
        ? { connect: { id: parsed.data.categoryId } }
        : { disconnect: true };
    }
    if (parsed.data.affiliateUrl !== undefined) data.affiliateUrl = parsed.data.affiliateUrl;
    if (parsed.data.startsAt !== undefined) {
      data.startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
    }
    if (parsed.data.expiresAt !== undefined) {
      data.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    }
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    return this.prisma.coupon.update({ where: { id }, data });
  }

  @Delete("coupons/:id")
  async deleteCoupon(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true };
  }

  @Post("coupons/bulk")
  async bulkCouponAction(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = bulkCouponSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const { ids, action } = parsed.data;
    if (action === "delete") {
      const result = await this.prisma.coupon.deleteMany({ where: { id: { in: ids } } });
      return { success: true, count: result.count };
    }
    // approve = activate, archive = deactivate. Coupon không có reviewedAt/By field.
    const isActive = action === "approve" || action === "activate";
    const result = await this.prisma.coupon.updateMany({
      where: { id: { in: ids } },
      data: { isActive }
    });
    return { success: true, count: result.count };
  }

  // ───── Analytics ─────

  @Get("analytics/overview")
  async getAnalyticsOverview(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(to) : now;

    const [
      clicks,
      conversions,
      revenueAgg,
      topProducts,
      topCategories,
      networkBreakdown
    ] = await Promise.all([
      this.prisma.clickLog.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.conversionWebhook.count({ where: { receivedAt: { gte: start, lte: end } } }),
      this.prisma.conversionWebhook.aggregate({
        _sum: { revenue: true },
        where: { receivedAt: { gte: start, lte: end } }
      }),
      this.prisma.clickLog.groupBy({
        by: ["productId"],
        _count: { _all: true },
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { _count: { productId: "desc" } },
        take: 10
      }),
      this.prisma.product.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
        where: { isPublic: true }
      }),
      this.prisma.conversionWebhook.groupBy({
        by: ["network"],
        _sum: { revenue: true },
        _count: { _all: true },
        where: { receivedAt: { gte: start, lte: end } }
      })
    ]);

    const productIds = topProducts.map((p) => p.productId);
    const productNames =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, network: true }
          })
        : [];
    const nameById = new Map(productNames.map((p) => [p.id, p]));

    const categoryIds = topCategories.map((c) => c.categoryId);
    const categoryNames =
      categoryIds.length > 0
        ? await this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, slug: true }
          })
        : [];
    const catById = new Map(categoryNames.map((c) => [c.id, c]));

    return {
      window: { from: start.toISOString(), to: end.toISOString() },
      clicks,
      conversions,
      conversionRate: clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0,
      revenue: (revenueAgg._sum.revenue ?? new Prisma.Decimal(0)).toString(),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: nameById.get(p.productId)?.name ?? "(deleted)",
        network: nameById.get(p.productId)?.network ?? null,
        clicks: p._count._all
      })),
      productCountByCategory: topCategories.map((c) => ({
        categoryId: c.categoryId,
        name: catById.get(c.categoryId)?.name ?? "(deleted)",
        slug: catById.get(c.categoryId)?.slug ?? "",
        count: c._count._all
      })),
      networkBreakdown: networkBreakdown.map((n) => ({
        network: n.network,
        revenue: (n._sum.revenue ?? new Prisma.Decimal(0)).toString(),
        count: n._count._all
      }))
    };
  }

  // ───── Crawler Logs ─────

  @Get("crawler/logs")
  async listCrawlerLogs(
    @Query("limit") limit = "30",
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.prisma.crawlerLog.findMany({
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(Number(limit), 1), 200)
    });
  }

  // ───── Categories ─────

  @Get("categories")
  async listCategories(@Headers("x-admin-role") role?: string, @Headers("x-admin-key") apiKey?: string) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.prisma.category.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { products: true, articles: true, campaignAssignments: true } } }
    });
  }

  @Get("categories/:id")
  async getCategory(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, articles: true, campaignAssignments: true } } }
    });
    if (!category) throw new HttpException("Category not found", HttpStatus.NOT_FOUND);
    return category;
  }

  @Post("categories")
  async createCategory(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = createCategorySchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const existing = await this.prisma.category.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      throw new HttpException("Slug đã tồn tại", HttpStatus.CONFLICT);
    }
    return this.prisma.category.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        schemaConfig: parsed.data.schemaConfig as Prisma.InputJsonValue
      }
    });
  }

  @Put("categories/:id")
  async updateCategory(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = updateCategorySchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data: Prisma.CategoryUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.slug !== undefined) {
      const conflict = await this.prisma.category.findFirst({
        where: { slug: parsed.data.slug, NOT: { id } },
        select: { id: true }
      });
      if (conflict) throw new HttpException("Slug đã tồn tại", HttpStatus.CONFLICT);
      data.slug = parsed.data.slug;
    }
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.schemaConfig !== undefined) {
      data.schemaConfig = parsed.data.schemaConfig as Prisma.InputJsonValue;
    }
    if (parsed.data.seoTitle !== undefined) data.seoTitle = parsed.data.seoTitle;
    if (parsed.data.seoDescription !== undefined) data.seoDescription = parsed.data.seoDescription;
    return this.prisma.category.update({ where: { id }, data });
  }

  @Delete("categories/:id")
  async deleteCategory(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new HttpException(
        `Không thể xoá: danh mục có ${count} sản phẩm. Hãy xoá/chuyển sản phẩm trước.`,
        HttpStatus.CONFLICT
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  @Post("categories/bulk")
  async bulkCategoryAction(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = bulkCategorySchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const { ids, action } = parsed.data;
    if (action === "delete") {
      const blocking = await this.prisma.product.count({
        where: { categoryId: { in: ids } }
      });
      if (blocking > 0) {
        throw new HttpException(
          `Không thể xoá: có ${blocking} sản phẩm đang trỏ vào danh mục đã chọn. Xoá sản phẩm trước.`,
          HttpStatus.CONFLICT
        );
      }
      const result = await this.prisma.category.deleteMany({ where: { id: { in: ids } } });
      return { success: true, count: result.count };
    }
    const status = action === "activate" ? CategoryStatus.ACTIVE : CategoryStatus.INACTIVE;
    const result = await this.prisma.category.updateMany({
      where: { id: { in: ids } },
      data: { status }
    });
    return { success: true, count: result.count };
  }

  // ───── Products (admin manual CRUD) ─────

  @Get("products")
  async listProducts(
    @Query("categoryId") categoryId?: string,
    @Query("network") network?: string,
    @Query("isPublic") isPublic?: string,
    @Query("search") search?: string,
    @Query("limit") limit = "100",
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.ProductWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (network && (Object.values(AffiliateNetwork) as string[]).includes(network)) {
      where.network = network as AffiliateNetwork;
    }
    if (isPublic === "true") where.isPublic = true;
    if (isPublic === "false") where.isPublic = false;
    if (search) where.name = { contains: search, mode: "insensitive" };
    return this.prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, slug: true, name: true } },
        campaign: { select: { id: true, name: true, atCampaignId: true } },
        _count: { select: { clickLogs: true, extractions: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(Math.max(Number(limit), 1), 500)
    });
  }

  @Get("products/:id")
  async getProductAdmin(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, slug: true, name: true } } }
    });
    if (!product) throw new HttpException("Product not found", HttpStatus.NOT_FOUND);
    return product;
  }

  @Post("products")
  async createProduct(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = createProductSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const category = await this.prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
      select: { id: true }
    });
    if (!category) {
      throw new HttpException("Danh mục không tồn tại", HttpStatus.BAD_REQUEST);
    }

    const slug = await uniqueSlugWithin(parsed.data.name, async (candidate) => {
      const found = await this.prisma.product.findFirst({
        where: { categoryId: parsed.data.categoryId, slug: candidate },
        select: { id: true }
      });
      return Boolean(found);
    });

    return this.prisma.product.create({
      data: {
        name: parsed.data.name,
        affiliateUrl: parsed.data.affiliateUrl,
        categoryId: parsed.data.categoryId,
        network: parsed.data.network,
        slug,
        isPublic: parsed.data.isPublic ?? false,
        scrapedData: (parsed.data.scrapedData ?? {}) as Prisma.InputJsonValue
      }
    });
  }

  @Put("products/:id")
  async updateProduct(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = updateProductSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data: Prisma.ProductUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.affiliateUrl !== undefined) data.affiliateUrl = parsed.data.affiliateUrl;
    if (parsed.data.network !== undefined) data.network = parsed.data.network;
    if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;
    if (parsed.data.scrapedData !== undefined) {
      data.scrapedData = parsed.data.scrapedData as Prisma.InputJsonValue;
    }
    if (parsed.data.categoryId !== undefined) {
      data.category = { connect: { id: parsed.data.categoryId } };
    }
    if (parsed.data.campaignId !== undefined) {
      data.campaign =
        parsed.data.campaignId === null
          ? { disconnect: true }
          : { connect: { id: parsed.data.campaignId } };
    }
    return this.prisma.product.update({ where: { id }, data });
  }

  @Delete("products/:id")
  async deleteProduct(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  @Post("products/bulk")
  async bulkProductAction(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = bulkProductSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const { ids, action } = parsed.data;
    if (action === "delete") {
      const result = await this.prisma.product.deleteMany({ where: { id: { in: ids } } });
      return { success: true, count: result.count };
    }
    const isPublic = action === "make-public";
    const result = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isPublic }
    });
    return { success: true, count: result.count };
  }

  // ───── Campaigns (affiliate campaigns per network) ─────

  @Post("campaigns/sync-from-at")
  async syncCampaignsFromAt(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    try {
      return await this.campaignSync.syncFromAccesstrade();
    } catch (error: unknown) {
      this.logger.error(
        "syncCampaignsFromAt failed",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException(
        "Sync campaigns failed — xem log server",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("campaigns")
  async listCampaigns(
    @Query("network") network?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("assignment") assignment?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.CampaignWhereInput = {};
    if (network && (Object.values(AffiliateNetwork) as string[]).includes(network)) {
      where.network = network as AffiliateNetwork;
    }
    if (status && (Object.values(CampaignStatus) as string[]).includes(status)) {
      where.status = status as CampaignStatus;
    }
    if (assignment === "assigned") where.assignments = { some: {} };
    if (assignment === "unassigned") where.assignments = { none: {} };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { merchantName: { contains: search, mode: "insensitive" } },
        { externalId: { contains: search, mode: "insensitive" } },
        { atCategoryName: { contains: search, mode: "insensitive" } }
      ];
    }
    return this.prisma.campaign.findMany({
      where,
      orderBy: [{ status: "asc" }, { network: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true, conversions: true } },
        assignments: {
          include: { category: { select: { id: true, name: true, slug: true } } },
          orderBy: { priority: "asc" }
        }
      },
      take: 500
    });
  }

  // ───── Campaign ↔ Category assignments (N:N) ─────

  @Get("campaigns/:id/assignments")
  async listCampaignAssignments(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, select: { id: true } });
    if (!campaign) throw new HttpException("Campaign not found", HttpStatus.NOT_FOUND);
    return this.prisma.campaignCategory.findMany({
      where: { campaignId: id },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { priority: "asc" }
    });
  }

  @Post("campaigns/:id/assignments")
  async createCampaignAssignment(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = createAssignmentSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new HttpException("Campaign not found", HttpStatus.NOT_FOUND);

    let categoryId = parsed.data.categoryId ?? null;
    if (parsed.data.newCategory) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: parsed.data.newCategory.slug }
      });
      if (existing) {
        throw new HttpException(
          `Slug "${parsed.data.newCategory.slug}" đã tồn tại — chọn slug khác hoặc assign vào category đó.`,
          HttpStatus.CONFLICT
        );
      }
      const created = await this.prisma.category.create({
        data: {
          name: parsed.data.newCategory.name,
          slug: parsed.data.newCategory.slug,
          status: CategoryStatus.ACTIVE,
          schemaConfig: parsed.data.newCategory.schemaConfig as Prisma.InputJsonValue
        }
      });
      categoryId = created.id;
    }

    if (!categoryId) {
      throw new HttpException("Thiếu categoryId", HttpStatus.BAD_REQUEST);
    }
    const exists = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!exists) {
      throw new HttpException("Category không tồn tại", HttpStatus.BAD_REQUEST);
    }

    const dup = await this.prisma.campaignCategory.findUnique({
      where: { campaignId_categoryId: { campaignId: id, categoryId } }
    });
    if (dup) {
      throw new HttpException(
        "Cặp (campaign, category) đã tồn tại — sửa filterRules thay vì tạo mới.",
        HttpStatus.CONFLICT
      );
    }

    const assignment = await this.prisma.campaignCategory.create({
      data: {
        campaignId: id,
        categoryId,
        filterRules: parsed.data.filterRules as Prisma.InputJsonValue,
        priority: parsed.data.priority ?? 100
      },
      include: { category: { select: { id: true, name: true, slug: true } } }
    });

    // Khi assign assignment đầu tiên, auto chuyển campaign sang APPROVED để crawler pick up.
    if (campaign.status !== CampaignStatus.APPROVED) {
      await this.prisma.campaign.update({
        where: { id },
        data: {
          status: CampaignStatus.APPROVED,
          approvedAt: campaign.approvedAt ?? new Date()
        }
      });
    }

    return assignment;
  }

  @Put("campaigns/:id/assignments/:assignmentId")
  async updateCampaignAssignment(
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = updateAssignmentSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const existing = await this.prisma.campaignCategory.findUnique({
      where: { id: assignmentId }
    });
    if (!existing || existing.campaignId !== id) {
      throw new HttpException("Assignment not found", HttpStatus.NOT_FOUND);
    }
    const data: Prisma.CampaignCategoryUpdateInput = {};
    if (parsed.data.filterRules !== undefined) {
      data.filterRules = parsed.data.filterRules as Prisma.InputJsonValue;
    }
    if (parsed.data.priority !== undefined) {
      data.priority = parsed.data.priority;
    }
    return this.prisma.campaignCategory.update({
      where: { id: assignmentId },
      data,
      include: { category: { select: { id: true, name: true, slug: true } } }
    });
  }

  @Delete("campaigns/:id/assignments/:assignmentId")
  async deleteCampaignAssignment(
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const existing = await this.prisma.campaignCategory.findUnique({
      where: { id: assignmentId }
    });
    if (!existing || existing.campaignId !== id) {
      throw new HttpException("Assignment not found", HttpStatus.NOT_FOUND);
    }
    await this.prisma.campaignCategory.delete({ where: { id: assignmentId } });
    return { success: true };
  }

  @Get("campaigns/:id")
  async getCampaign(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, conversions: true } }
      }
    });
    if (!campaign) throw new HttpException("Campaign not found", HttpStatus.NOT_FOUND);
    return campaign;
  }

  @Post("campaigns")
  async createCampaign(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = createCampaignSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const dup = await this.prisma.campaign.findUnique({
      where: {
        network_externalId: { network: parsed.data.network, externalId: parsed.data.externalId }
      }
    });
    if (dup) {
      throw new HttpException(
        `Đã tồn tại campaign ${parsed.data.network}/${parsed.data.externalId}`,
        HttpStatus.CONFLICT
      );
    }
    return this.prisma.campaign.create({
      data: {
        network: parsed.data.network,
        externalId: parsed.data.externalId,
        name: parsed.data.name,
        merchantName: parsed.data.merchantName ?? null,
        status: parsed.data.status ?? CampaignStatus.APPLIED,
        appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : null,
        approvedAt: parsed.data.approvedAt ? new Date(parsed.data.approvedAt) : null,
        commissionNote: parsed.data.commissionNote ?? null,
        notes: parsed.data.notes ?? null
      }
    });
  }

  @Put("campaigns/:id")
  async updateCampaign(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = updateCampaignSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data: Prisma.CampaignUpdateInput = {};
    if (parsed.data.network !== undefined) data.network = parsed.data.network;
    if (parsed.data.externalId !== undefined) data.externalId = parsed.data.externalId;
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.merchantName !== undefined) data.merchantName = parsed.data.merchantName;
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      // Auto-stamp approvedAt khi chuyển sang APPROVED lần đầu (nếu chưa có).
      if (parsed.data.status === CampaignStatus.APPROVED && parsed.data.approvedAt === undefined) {
        const existing = await this.prisma.campaign.findUnique({ where: { id }, select: { approvedAt: true } });
        if (existing && !existing.approvedAt) {
          data.approvedAt = new Date();
        }
      }
    }
    if (parsed.data.appliedAt !== undefined) {
      data.appliedAt = parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : null;
    }
    if (parsed.data.approvedAt !== undefined) {
      data.approvedAt = parsed.data.approvedAt ? new Date(parsed.data.approvedAt) : null;
    }
    if (parsed.data.commissionNote !== undefined) data.commissionNote = parsed.data.commissionNote;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

    return this.prisma.campaign.update({ where: { id }, data });
  }

  @Delete("campaigns/:id")
  async deleteCampaign(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const counts = await this.prisma.campaign.findUnique({
      where: { id },
      include: { _count: { select: { products: true, conversions: true } } }
    });
    if (!counts) throw new HttpException("Campaign not found", HttpStatus.NOT_FOUND);
    if (counts._count.products > 0 || counts._count.conversions > 0) {
      // SetNull on relations đã được khai báo trong schema, nên xoá vẫn an toàn — nhưng cảnh báo admin
      // để tránh xoá nhầm: prefer chuyển status sang INACTIVE thay vì xoá.
      throw new HttpException(
        `Campaign đang gắn ${counts._count.products} sản phẩm + ${counts._count.conversions} conversion. ` +
          `Chuyển status sang INACTIVE thay vì xoá để giữ tracking lịch sử.`,
        HttpStatus.CONFLICT
      );
    }
    await this.prisma.campaign.delete({ where: { id } });
    return { success: true };
  }

  @Post("campaigns/bulk")
  async bulkCampaignAction(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = bulkCampaignSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const { ids, action, categoryId } = parsed.data;
    if (action === "assign-category") {
      // categoryId đã được validate bởi schema refine
      const exists = await this.prisma.category.findUnique({
        where: { id: categoryId! },
        select: { id: true }
      });
      if (!exists) {
        throw new HttpException("Category không tồn tại", HttpStatus.BAD_REQUEST);
      }
      // N:N: tạo CampaignCategory cho mỗi campaign trong ids. Cặp đã tồn tại → skip.
      // Cũng auto-approve campaign khi có assignment mới (signal cho crawler-cycle pick up).
      let count = 0;
      let skipped = 0;
      for (const campaignId of ids) {
        const dup = await this.prisma.campaignCategory.findUnique({
          where: { campaignId_categoryId: { campaignId, categoryId: categoryId! } }
        });
        if (dup) {
          skipped += 1;
          continue;
        }
        await this.prisma.campaignCategory.create({
          data: {
            campaignId,
            categoryId: categoryId!,
            filterRules: DEFAULT_FILTER_RULES as unknown as Prisma.InputJsonValue,
            priority: 100
          }
        });
        const campaign = await this.prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true, approvedAt: true }
        });
        if (campaign && campaign.status !== CampaignStatus.APPROVED) {
          await this.prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status: CampaignStatus.APPROVED,
              approvedAt: campaign.approvedAt ?? new Date()
            }
          });
        }
        count += 1;
      }
      return { success: true, count, skipped };
    }
    // action format "status:XXX"
    const statusValue = action.replace("status:", "") as CampaignStatus;
    if (!(Object.values(CampaignStatus) as string[]).includes(statusValue)) {
      throw new HttpException("Status không hợp lệ", HttpStatus.BAD_REQUEST);
    }
    const result = await this.prisma.campaign.updateMany({
      where: { id: { in: ids } },
      data: { status: statusValue }
    });
    return { success: true, count: result.count };
  }

  // ───── Top products ─────

  @Post("top-products/sync")
  async syncTopProducts(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    try {
      return await this.topProducts.syncDailySnapshot();
    } catch (error: unknown) {
      this.logger.error(
        "syncTopProducts failed",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException(
        "Sync top products failed — xem log server",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ───── Reconciliation ─────

  @Post("reconciliation/run")
  async runReconciliation(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    try {
      return await this.reconciliation.runReconcileCycle("manual");
    } catch (error: unknown) {
      this.logger.error(
        "runReconciliation failed",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException(
        "Reconciliation failed — xem log server",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("reconciliation/logs")
  async listReconciliationLogs(
    @Query("limit") limit?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const take = Math.min(Math.max(Number(limit ?? 20), 1), 100);
    return this.prisma.reconciliationLog.findMany({
      orderBy: { startedAt: "desc" },
      take
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
