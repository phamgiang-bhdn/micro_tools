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
import { AffiliateNetwork, ArticleStatus, ArticleType, CampaignStatus, NicheStatus, ParseStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { AiService } from "../../services/ai.service";
import { ArticleService } from "../../services/article.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CampaignSyncService } from "../crawler/campaign-sync.service";
import { CouponSyncService } from "../crawler/coupon-sync.service";
import { filterRulesSchema } from "../crawler/dto/filter-rules.dto";
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
  nicheId: z.string().uuid().nullable().optional(),
  pinnedProductIds: z.array(z.string().uuid()).max(10).optional(),
  productRef: z.string().min(1).max(500).nullable().optional()
});

const createNicheSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug chỉ chứa chữ thường, số, gạch ngang"),
  schemaConfig: z.record(z.unknown())
});

const updateNicheSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  status: z.nativeEnum(NicheStatus).optional(),
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
  nicheId: z.string().uuid().optional().nullable(),
  affiliateUrl: z.string().url().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional()
});

const updateCouponSchema = createCouponSchema.partial();

const updateProductSchema = z.object({
  name: z.string().min(2).max(300).optional(),
  affiliateUrl: z.string().url().optional(),
  nicheId: z.string().uuid().optional(),
  network: z.nativeEnum(AffiliateNetwork).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  isPublic: z.boolean().optional(),
  scrapedData: z.record(z.unknown()).optional()
});

const createProductSchema = z.object({
  name: z.string().min(2).max(300),
  affiliateUrl: z.string().url(),
  nicheId: z.string().uuid(),
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

const updateCampaignSchema = createCampaignSchema.partial().extend({
  network: z.nativeEnum(AffiliateNetwork).optional(),
  externalId: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  /// PR5: filterRules ở Campaign level. Null = clear (về DEFAULT_FILTER_RULES khi crawl).
  filterRules: filterRulesSchema.nullable().optional()
});

const bulkNicheSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["activate", "deactivate", "delete"])
});

const bulkProductSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1),
    action: z.enum(["make-public", "make-private", "delete", "assign-niche", "clear-niche"]),
    nicheId: z.string().uuid().optional()
  })
  .refine(
    (d) => d.action !== "assign-niche" || Boolean(d.nicheId),
    { message: "nicheId là bắt buộc cho action assign-niche" }
  );

const bulkCampaignSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.union([
    z.literal("status:APPROVED"),
    z.literal("status:PAUSED"),
    z.literal("status:REJECTED"),
    z.literal("status:INACTIVE")
  ])
});

const bulkCouponSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["approve", "archive", "activate", "deactivate", "delete"])
});

const updateCategorySchema = z.object({
  displayName: z.string().trim().min(1).max(120).nullable().optional()
});

const updateLookupDisplayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(120).nullable().optional()
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
  nicheId: z.string().uuid().nullable().optional(),
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
          include: { niche: { select: { name: true, slug: true } } }
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
      include: { product: { include: { niche: true } } }
    });
    if (!extraction) {
      throw new HttpException("Extraction not found", HttpStatus.NOT_FOUND);
    }

    if (!extraction.product.niche) {
      throw new HttpException(
        "Product chưa được gán niche — không có schemaConfig để extract. Admin gán niche trước trong /admin/products.",
        HttpStatus.PRECONDITION_FAILED
      );
    }
    const schema = extraction.product.niche.schemaConfig as Record<string, unknown>;
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
        niche: { select: { slug: true, name: true } }
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
      include: { niche: { select: { id: true, slug: true, name: true } } }
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
    if (parsed.data.type === ArticleType.BUYING_GUIDE && !parsed.data.nicheId) {
      throw new HttpException("BUYING_GUIDE bài cần chọn niche", HttpStatus.BAD_REQUEST);
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
        nicheId: parsed.data.nicheId ?? null,
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
        nicheId: input.nicheId ?? null,
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
    if (parsed.data.nicheId !== undefined) {
      data.niche = parsed.data.nicheId ? { connect: { id: parsed.data.nicheId } } : { disconnect: true };
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
        nicheId: src.nicheId,
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
        niche: { select: { id: true, name: true } }
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
        nicheId: parsed.data.nicheId ?? null,
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
    if (parsed.data.nicheId !== undefined) {
      data.niche = parsed.data.nicheId
        ? { connect: { id: parsed.data.nicheId } }
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
      topNiches,
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
        by: ["nicheId"],
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

    const nicheIds = topNiches
      .map((c) => c.nicheId)
      .filter((id): id is string => id !== null);
    const nicheNames =
      nicheIds.length > 0
        ? await this.prisma.niche.findMany({
            where: { id: { in: nicheIds } },
            select: { id: true, name: true, slug: true }
          })
        : [];
    const nicheById = new Map(nicheNames.map((c) => [c.id, c]));

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
      productCountByNiche: topNiches.map((c) => ({
        nicheId: c.nicheId,
        name: c.nicheId ? nicheById.get(c.nicheId)?.name ?? "(deleted)" : "(chưa gán)",
        slug: c.nicheId ? nicheById.get(c.nicheId)?.slug ?? "" : "",
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

  // ───── Niches ─────

  @Get("niches")
  async listNiches(@Headers("x-admin-role") role?: string, @Headers("x-admin-key") apiKey?: string) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.prisma.niche.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { products: true, articles: true } } }
    });
  }

  @Get("niches/:id")
  async getNiche(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const niche = await this.prisma.niche.findUnique({
      where: { id },
      include: { _count: { select: { products: true, articles: true } } }
    });
    if (!niche) throw new HttpException("Niche not found", HttpStatus.NOT_FOUND);
    return niche;
  }

  @Post("niches")
  async createNiche(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = createNicheSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const existing = await this.prisma.niche.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      throw new HttpException("Slug đã tồn tại", HttpStatus.CONFLICT);
    }
    return this.prisma.niche.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        schemaConfig: parsed.data.schemaConfig as Prisma.InputJsonValue
      }
    });
  }

  @Put("niches/:id")
  async updateNiche(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = updateNicheSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data: Prisma.NicheUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.slug !== undefined) {
      const conflict = await this.prisma.niche.findFirst({
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
    return this.prisma.niche.update({ where: { id }, data });
  }

  @Delete("niches/:id")
  async deleteNiche(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const count = await this.prisma.product.count({ where: { nicheId: id } });
    if (count > 0) {
      throw new HttpException(
        `Không thể xoá: niche có ${count} sản phẩm. Hãy xoá/chuyển sản phẩm trước.`,
        HttpStatus.CONFLICT
      );
    }
    await this.prisma.niche.delete({ where: { id } });
    return { success: true };
  }

  @Post("niches/bulk")
  async bulkNicheAction(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = bulkNicheSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const { ids, action } = parsed.data;
    if (action === "delete") {
      const blocking = await this.prisma.product.count({
        where: { nicheId: { in: ids } }
      });
      if (blocking > 0) {
        throw new HttpException(
          `Không thể xoá: có ${blocking} sản phẩm đang trỏ vào niche đã chọn. Xoá sản phẩm trước.`,
          HttpStatus.CONFLICT
        );
      }
      const result = await this.prisma.niche.deleteMany({ where: { id: { in: ids } } });
      return { success: true, count: result.count };
    }
    const status = action === "activate" ? NicheStatus.ACTIVE : NicheStatus.INACTIVE;
    const result = await this.prisma.niche.updateMany({
      where: { id: { in: ids } },
      data: { status }
    });
    return { success: true, count: result.count };
  }

  // ───── Categories (AT taxonomy — PR2) ─────
  //
  // Auto-populated bởi crawler khi import offer (theo offer.atCategorySlug).
  // Admin chỉ cần điền `displayName` để storefront hiện filter — không tạo/xoá manual ở phase này.

  @Get("categories")
  async listCategories(
    @Query("hasDisplayName") hasDisplayName?: string,
    @Query("search") search?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.CategoryWhereInput = {};
    if (hasDisplayName === "true") where.displayName = { not: null };
    if (hasDisplayName === "false") where.displayName = null;
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: "insensitive" } },
        { rawValue: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } }
      ];
    }
    return this.prisma.category.findMany({
      where,
      orderBy: [{ displayName: { sort: "asc", nulls: "first" } }, { rawValue: "asc" }],
      include: { _count: { select: { products: true } } }
    });
  }

  @Put("categories/:id")
  async updateCategoryDisplayName(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = updateCategorySchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        displayName: parsed.data.displayName ?? null
      }
    });
  }

  // ───── Sources (nơi bán — PR3) ─────

  @Get("sources")
  async listSources(
    @Query("hasDisplayName") hasDisplayName?: string,
    @Query("search") search?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.SourceWhereInput = {};
    if (hasDisplayName === "true") where.displayName = { not: null };
    if (hasDisplayName === "false") where.displayName = null;
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: "insensitive" } },
        { rawValue: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } }
      ];
    }
    return this.prisma.source.findMany({
      where,
      orderBy: [{ displayName: { sort: "asc", nulls: "first" } }, { rawValue: "asc" }],
      include: { _count: { select: { products: true } } }
    });
  }

  @Put("sources/:id")
  async updateSourceDisplayName(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = updateLookupDisplayNameSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    return this.prisma.source.update({
      where: { id },
      data: { displayName: parsed.data.displayName ?? null }
    });
  }

  // ───── Brands (thương hiệu — PR3) ─────

  @Get("brands")
  async listBrands(
    @Query("hasDisplayName") hasDisplayName?: string,
    @Query("search") search?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.BrandWhereInput = {};
    if (hasDisplayName === "true") where.displayName = { not: null };
    if (hasDisplayName === "false") where.displayName = null;
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: "insensitive" } },
        { rawValue: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } }
      ];
    }
    return this.prisma.brand.findMany({
      where,
      orderBy: [{ displayName: { sort: "asc", nulls: "first" } }, { rawValue: "asc" }],
      include: { _count: { select: { products: true } } }
    });
  }

  @Put("brands/:id")
  async updateBrandDisplayName(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = updateLookupDisplayNameSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    return this.prisma.brand.update({
      where: { id },
      data: { displayName: parsed.data.displayName ?? null }
    });
  }

  // ───── Products (admin manual CRUD) ─────

  @Get("products")
  async listProducts(
    @Query("nicheId") nicheId?: string,
    @Query("nicheStatus") nicheStatus?: string,
    @Query("categoryId") productCategoryId?: string,
    @Query("sourceId") sourceId?: string,
    @Query("brandId") brandId?: string,
    @Query("network") network?: string,
    @Query("isPublic") isPublic?: string,
    @Query("search") search?: string,
    @Query("limit") limit = "100",
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.ProductWhereInput = {};
    if (nicheId) where.nicheId = nicheId;
    if (nicheStatus === "unassigned") where.nicheId = null;
    if (nicheStatus === "assigned") where.nicheId = { not: null };
    if (productCategoryId) where.categoryId = productCategoryId;
    if (sourceId) where.sourceId = sourceId;
    if (brandId) where.brandId = brandId;
    if (network && (Object.values(AffiliateNetwork) as string[]).includes(network)) {
      where.network = network as AffiliateNetwork;
    }
    if (isPublic === "true") where.isPublic = true;
    if (isPublic === "false") where.isPublic = false;
    if (search) where.name = { contains: search, mode: "insensitive" };
    return this.prisma.product.findMany({
      where,
      include: {
        niche: { select: { id: true, slug: true, name: true } },
        category: { select: { id: true, slug: true, rawValue: true, displayName: true } },
        source: { select: { id: true, slug: true, rawValue: true, displayName: true } },
        brand: { select: { id: true, slug: true, rawValue: true, displayName: true } },
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
      include: { niche: { select: { id: true, slug: true, name: true } } }
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
    const niche = await this.prisma.niche.findUnique({
      where: { id: parsed.data.nicheId },
      select: { id: true }
    });
    if (!niche) {
      throw new HttpException("Niche không tồn tại", HttpStatus.BAD_REQUEST);
    }

    const slug = await uniqueSlugWithin(parsed.data.name, async (candidate) => {
      const found = await this.prisma.product.findFirst({
        where: { nicheId: parsed.data.nicheId, slug: candidate },
        select: { id: true }
      });
      return Boolean(found);
    });

    return this.prisma.product.create({
      data: {
        name: parsed.data.name,
        affiliateUrl: parsed.data.affiliateUrl,
        nicheId: parsed.data.nicheId,
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
    if (parsed.data.nicheId !== undefined) {
      data.niche = { connect: { id: parsed.data.nicheId } };
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
    const { ids, action, nicheId } = parsed.data;
    if (action === "delete") {
      const result = await this.prisma.product.deleteMany({ where: { id: { in: ids } } });
      return { success: true, count: result.count };
    }
    if (action === "assign-niche") {
      const exists = await this.prisma.niche.findUnique({ where: { id: nicheId! }, select: { id: true } });
      if (!exists) throw new HttpException("Niche không tồn tại", HttpStatus.BAD_REQUEST);
      const result = await this.prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { nicheId: nicheId! }
      });
      return { success: true, count: result.count };
    }
    if (action === "clear-niche") {
      const result = await this.prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { nicheId: null, isPublic: false }
      });
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
        _count: { select: { products: true, conversions: true } }
      },
      take: 500
    });
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
    if (parsed.data.filterRules !== undefined) {
      data.filterRules = parsed.data.filterRules === null
        ? Prisma.JsonNull
        : (parsed.data.filterRules as Prisma.InputJsonValue);
    }

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
    const { ids, action } = parsed.data;
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
