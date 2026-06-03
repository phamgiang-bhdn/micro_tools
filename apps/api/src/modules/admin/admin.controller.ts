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
import { ArticlePipelineService } from "../article-pipeline/article-pipeline.service";
import { PipelineStageName } from "../article-pipeline/pipeline.types";
import { PrismaService } from "../../prisma/prisma.service";
import { CampaignSyncService } from "../crawler/campaign-sync.service";
import { CouponSyncService } from "../crawler/coupon-sync.service";
import { CrawlerService } from "../crawler/crawler.service";
import { filterRulesSchema } from "../crawler/dto/filter-rules.dto";
import { TopProductsSyncService } from "../crawler/top-products-sync.service";
import { MoneyTrailService } from "../insights/money-trail.service";
import { RealBestsellerService } from "../insights/real-bestseller.service";
import { ReconciliationService } from "../reconciliation/reconciliation.service";
import { RefineryService } from "../refinery/refinery.service";
import { ToolScoringService } from "../tool/scoring.service";
import { InventoryCheckService } from "../tool/inventory-check.service";
import { slugify, uniqueSlugWithin } from "../../utils/slug.util";

// === at-money-flows-v1 schemas ===
const bulkApproveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100)
});

const SYNC_NAMES = ["crawler", "reconcile", "coupon", "top_products"] as const;
type SyncName = (typeof SYNC_NAMES)[number];

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
  productRef: z.string().min(1).max(500).nullable().optional(),
  pauseAtOutline: z.boolean().optional()
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
  shopId: z.string().uuid().nullable().optional(),
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

const createShopSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "slug chỉ chứa chữ thường, số, gạch ngang")
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  websiteUrl: z.string().url().max(500).nullable().optional()
});

const updateShopSchema = createShopSchema.partial();

const bulkAssignShopSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  shopId: z.string().uuid().nullable()
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
    private readonly articlePipeline: ArticlePipelineService,
    private readonly campaignSync: CampaignSyncService,
    private readonly reconciliation: ReconciliationService,
    private readonly couponSync: CouponSyncService,
    private readonly topProducts: TopProductsSyncService,
    private readonly crawler: CrawlerService,
    private readonly realBestseller: RealBestsellerService,
    private readonly moneyTrail: MoneyTrailService,
    private readonly refinery: RefineryService,
    private readonly toolScoring: ToolScoringService,
    private readonly inventoryCheck: InventoryCheckService
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

    const { id } = await this.articlePipeline.createAndStart({
      type: parsed.data.type,
      topic: parsed.data.topic,
      nicheId: parsed.data.nicheId ?? null,
      productRef: parsed.data.productRef ?? null,
      pinnedProductIds: parsed.data.pinnedProductIds ?? [],
      pauseAtOutline: parsed.data.pauseAtOutline ?? false
    });
    return { id, status: ArticleStatus.DRAFT_BRIEF };
  }

  @Post("articles/:id/continue-pipeline")
  async continueArticlePipeline(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    await this.articlePipeline.continuePipeline(id);
    return { success: true };
  }

  @Post("articles/:id/retry-stage")
  async retryArticleStage(
    @Param("id") id: string,
    @Body() body: { stage?: string },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const stage = body?.stage;
    const valid = Object.values(PipelineStageName);
    if (!stage || !valid.includes(stage as PipelineStageName)) {
      throw new HttpException(
        `stage required, one of: ${valid.join(", ")}`,
        HttpStatus.BAD_REQUEST
      );
    }
    await this.articlePipeline.retryStage(id, stage as PipelineStageName);
    return { success: true };
  }

  @Post("articles/:id/refresh-evidence")
  async refreshArticleEvidence(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    await this.articlePipeline.refreshEvidence(id);
    return { success: true };
  }

  @Post("articles/:id/request-revision")
  async requestArticleRevision(
    @Param("id") id: string,
    @Body() body: { reason?: string; reviewer?: string },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const reason = (body?.reason ?? "").trim();
    if (!reason) throw new HttpException("reason required", HttpStatus.BAD_REQUEST);
    await this.articlePipeline.requestRevision(id, reason, body?.reviewer ?? "admin");
    return { success: true };
  }

  private async ensureUniqueArticleSlug(candidate: string, excludeId?: string): Promise<string> {
    let slug = candidate;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.article.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) return slug;
      suffix += 1;
      slug = `${candidate}-${suffix}`;
      if (suffix > 50) return `${candidate}-${Date.now().toString(36)}`;
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
      data.slug = await this.ensureUniqueArticleSlug(parsed.data.slug, id);
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
    const newSlug = await this.ensureUniqueArticleSlug(`${src.slug}-copy`);
    return this.prisma.article.create({
      data: {
        slug: newSlug,
        title: `${src.title} (bản sao)`,
        excerpt: src.excerpt,
        body: src.body,
        blocks: src.blocks ?? Prisma.JsonNull,
        coverImage: src.coverImage,
        type: src.type,
        status: ArticleStatus.PENDING_REVIEW,
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
    if (body.action === "publish") {
      // HITL gate cứng: chỉ publish bài đang ở PENDING_REVIEW.
      const result = await this.prisma.article.updateMany({
        where: {
          id: { in: body.ids },
          status: ArticleStatus.PENDING_REVIEW
        },
        data: {
          status: ArticleStatus.PUBLISHED,
          reviewedBy: reviewer,
          reviewedAt: new Date(),
          publishedAt: new Date()
        }
      });
      return { success: true, count: result.count, skipped: body.ids.length - result.count };
    }
    const result = await this.prisma.article.updateMany({
      where: { id: { in: body.ids } },
      data: {
        status: ArticleStatus.ARCHIVED,
        reviewedBy: reviewer,
        reviewedAt: new Date()
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
    const article = await this.prisma.article.findUnique({ where: { id }, select: { status: true } });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);

    // HITL gate cứng: chỉ cho phép publish từ PENDING_REVIEW.
    if (article.status !== ArticleStatus.PENDING_REVIEW) {
      throw new HttpException(
        `Không thể publish ở status ${article.status}. Cần PENDING_REVIEW.`,
        HttpStatus.CONFLICT
      );
    }
    await this.articlePipeline.approve(id, body?.reviewer || "admin");
    return { success: true };
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

  // ───── Shops (admin manual CRUD — AT không trả shop) ─────

  @Get("shops")
  async listShops(
    @Query("search") search?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where: Prisma.ShopWhereInput = {};
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } }
      ];
    }
    return this.prisma.shop.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } }
    });
  }

  @Get("shops/:id")
  async getShop(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } }
    });
    if (!shop) throw new HttpException("Shop not found", HttpStatus.NOT_FOUND);
    return shop;
  }

  @Post("shops")
  async createShop(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = createShopSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const slug = (parsed.data.slug ?? slugify(parsed.data.name)).trim();
    if (!slug) throw new HttpException("slug rỗng sau khi sinh", HttpStatus.BAD_REQUEST);
    const dupe = await this.prisma.shop.findUnique({ where: { slug } });
    if (dupe) throw new HttpException("Slug đã tồn tại", HttpStatus.CONFLICT);
    return this.prisma.shop.create({
      data: {
        slug,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        logoUrl: parsed.data.logoUrl ?? null,
        websiteUrl: parsed.data.websiteUrl ?? null
      }
    });
  }

  @Put("shops/:id")
  async updateShop(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = updateShopSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data: Prisma.ShopUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.logoUrl !== undefined) data.logoUrl = parsed.data.logoUrl;
    if (parsed.data.websiteUrl !== undefined) data.websiteUrl = parsed.data.websiteUrl;
    return this.prisma.shop.update({ where: { id }, data });
  }

  @Delete("shops/:id")
  async deleteShop(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    await this.prisma.shop.delete({ where: { id } });
    return { success: true };
  }

  @Post("products/bulk-assign-shop")
  async bulkAssignShop(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = bulkAssignShopSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const { ids, shopId } = parsed.data;
    if (shopId) {
      const exists = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } });
      if (!exists) throw new HttpException("Shop không tồn tại", HttpStatus.BAD_REQUEST);
    }
    const result = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { shopId }
    });
    return { success: true, count: result.count };
  }

  // ───── Products (admin manual CRUD) ─────

  @Get("products")
  async listProducts(
    @Query("nicheId") nicheId?: string,
    @Query("nicheStatus") nicheStatus?: string,
    @Query("shopId") shopId?: string,
    @Query("shopStatus") shopStatus?: string,
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
    if (shopId) where.shopId = shopId;
    if (shopStatus === "assigned") where.shopId = { not: null };
    if (shopStatus === "unassigned") where.shopId = null;
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
        shop: { select: { id: true, slug: true, name: true, logoUrl: true } },
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
    if (parsed.data.shopId !== undefined) {
      data.shop =
        parsed.data.shopId === null
          ? { disconnect: true }
          : { connect: { id: parsed.data.shopId } };
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

  // ──────── Article V2: sections / evidence / runs ────────

  @Get("articles/:id/v2-detail")
  async getArticleV2Detail(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        niche: true,
        author: true,
        sections: { orderBy: { order: "asc" } },
        evidence: { orderBy: { fetchedAt: "desc" } },
        runs: { orderBy: { startedAt: "desc" }, take: 50 }
      }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);
    // Dedupe runs server-side: keep latest per stage. Tránh overflow take=N khi nhiều retry
    // → stage cũ bị cắt → UI thấy "pending" cho stage thực ra đã success.
    const seen = new Set<string>();
    const dedupedRuns: typeof article.runs = [];
    for (const r of article.runs) {
      if (seen.has(r.stage)) continue;
      seen.add(r.stage);
      dedupedRuns.push(r);
    }
    return { ...article, runs: dedupedRuns };
  }

  /**
   * Lightweight endpoint cho UI poll mỗi 2s khi pipeline đang chạy.
   * Trả status hiện tại, message bước, percent, last 8 run logs — đủ render progress bar.
   * Không include section / evidence để tiết kiệm payload mỗi tick.
   */
  @Get("articles/:id/progress")
  async getArticleProgress(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        currentStageMessage: true,
        currentStageProgress: true,
        currentStageStartedAt: true,
        generationError: true,
        aiRevisionCount: true,
        wordCount: true,
        updatedAt: true
      }
    });
    if (!article) throw new HttpException("Article not found", HttpStatus.NOT_FOUND);
    // Dedupe server-side: lấy latest run per stage (8 stages × N retries → vượt take=8 → mất state).
    // Take 50 đủ cover 8 stage × 6 retry mỗi cái, rồi keep first-seen per stage ở memory.
    const recentRuns = await this.prisma.articleGenerationRun.findMany({
      where: { articleId: id },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true,
        stage: true,
        agent: true,
        success: true,
        errorReason: true,
        durationMs: true,
        startedAt: true,
        finishedAt: true
      }
    });
    const seenStages = new Set<string>();
    const runs: typeof recentRuns = [];
    for (const r of recentRuns) {
      if (seenStages.has(r.stage)) continue;
      seenStages.add(r.stage);
      runs.push(r);
    }
    return { article, runs };
  }

  @Put("articles/:id/sections/:sectionId")
  async updateSection(
    @Param("id") articleId: string,
    @Param("sectionId") sectionId: string,
    @Body() body: { heading?: string; summary?: string; blocks?: unknown; status?: string; evidenceRefs?: string[] },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const data: Prisma.ArticleSectionUpdateInput = {};
    if (body.heading !== undefined) data.heading = body.heading;
    if (body.summary !== undefined) data.summary = body.summary;
    if (body.blocks !== undefined) {
      data.blocks = body.blocks as Prisma.InputJsonValue;
      // Recompute wordCount khi admin sửa blocks tay — critic dùng để check thin section.
      data.wordCount = countBlocksWords(body.blocks);
    }
    if (body.status !== undefined) data.status = body.status;
    if (body.evidenceRefs !== undefined) data.evidenceRefs = { set: body.evidenceRefs };
    return this.prisma.articleSection.update({
      where: { id: sectionId, articleId },
      data
    });
  }

  @Delete("articles/:id/sections/:sectionId")
  async deleteSection(
    @Param("id") articleId: string,
    @Param("sectionId") sectionId: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    await this.prisma.articleSection.delete({ where: { id: sectionId, articleId } });
    // Compact order sau khi xoá để khỏi gap (1,2,4,5 → 1,2,3,4).
    const remaining = await this.prisma.articleSection.findMany({
      where: { articleId },
      orderBy: { order: "asc" },
      select: { id: true }
    });
    await this.prisma.$transaction(
      remaining.map((s, i) =>
        this.prisma.articleSection.update({ where: { id: s.id }, data: { order: i } })
      )
    );
    return { success: true };
  }

  @Put("articles/:id/sections-order")
  async reorderSections(
    @Param("id") articleId: string,
    @Body() body: { orderedIds?: string[] },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const ids = Array.isArray(body?.orderedIds) ? body.orderedIds.filter((v) => typeof v === "string") : [];
    if (ids.length === 0) throw new HttpException("orderedIds required", HttpStatus.BAD_REQUEST);
    // Validate tất cả id thuộc article (chặn cross-article tampering).
    const owned = await this.prisma.articleSection.findMany({
      where: { articleId, id: { in: ids } },
      select: { id: true }
    });
    if (owned.length !== ids.length) {
      throw new HttpException("Một số sectionId không thuộc article", HttpStatus.BAD_REQUEST);
    }
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.articleSection.update({ where: { id }, data: { order: i } })
      )
    );
    return { success: true };
  }

  // ──────── Product Slot Matcher ────────
  // Article topic-first: Writer sinh slot rỗng (productId undefined) với `hint` mô tả
  // Product cần gắn. Admin sau khi review bài vào tab "Gắn sản phẩm" → search Product
  // theo hint → assign. Endpoint dưới đây list slots + assign.

  @Get("articles/:id/slots")
  async listArticleSlots(
    @Param("id") articleId: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const sections = await this.prisma.articleSection.findMany({
      where: { articleId },
      orderBy: { order: "asc" },
      select: { id: true, order: true, heading: true, anchorSlug: true, blocks: true }
    });
    const slots: Array<{
      sectionId: string;
      sectionOrder: number;
      sectionHeading: string;
      slotKey: string;
      hint: string;
      angle?: string;
      productId?: string;
    }> = [];
    for (const s of sections) {
      if (!Array.isArray(s.blocks)) continue;
      for (const b of s.blocks as Array<Record<string, unknown>>) {
        if (b?.type !== "product_slot") continue;
        const slotKey = typeof b.slotKey === "string" ? b.slotKey : null;
        if (!slotKey) continue;
        slots.push({
          sectionId: s.id,
          sectionOrder: s.order,
          sectionHeading: s.heading,
          slotKey,
          hint: typeof b.hint === "string" ? b.hint : "",
          angle: typeof b.angle === "string" ? b.angle : undefined,
          productId: typeof b.productId === "string" ? b.productId : undefined
        });
      }
    }
    // Resolve assigned products để UI hiển thị card mini ngay (tránh round-trip 2 lần).
    const assignedIds = [...new Set(slots.map((s) => s.productId).filter((v): v is string => Boolean(v)))];
    const assignedProducts = assignedIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: assignedIds } },
          select: { id: true, name: true, slug: true, scrapedData: true, affiliateUrl: true, isPublic: true }
        })
      : [];
    return { slots, assignedProducts };
  }

  @Post("articles/:id/slots/assign")
  async assignSlotProduct(
    @Param("id") articleId: string,
    @Body() body: { sectionId?: string; slotKey?: string; productId?: string | null },
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const { sectionId, slotKey, productId } = body ?? {};
    if (!sectionId || !slotKey) {
      throw new HttpException("sectionId + slotKey required", HttpStatus.BAD_REQUEST);
    }
    if (productId) {
      const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new HttpException("Product không tồn tại", HttpStatus.NOT_FOUND);
    }

    const section = await this.prisma.articleSection.findUnique({
      where: { id: sectionId, articleId },
      select: { id: true, blocks: true }
    });
    if (!section) throw new HttpException("Section không thuộc article", HttpStatus.NOT_FOUND);

    const blocks = Array.isArray(section.blocks) ? [...(section.blocks as Array<Record<string, unknown>>)] : [];
    let matched = false;
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (b?.type === "product_slot" && b?.slotKey === slotKey) {
        blocks[i] = { ...b, productId: productId || undefined };
        matched = true;
      }
    }
    if (!matched) {
      throw new HttpException(`Không tìm thấy slot "${slotKey}" trong section`, HttpStatus.NOT_FOUND);
    }

    // Recompute article.productIds = union tất cả slot productId (đã gắn) + pinnedProductIds.
    // Public articles.controller chỉ join Product theo article.productIds → phải sync.
    const [updatedSection] = await this.prisma.$transaction([
      this.prisma.articleSection.update({
        where: { id: sectionId },
        data: { blocks: blocks as Prisma.InputJsonValue }
      })
    ]);
    await this.recomputeArticleProductIds(articleId);
    return { section: updatedSection };
  }

  /**
   * Sync `Article.productIds` = union(pinnedProductIds, tất cả product_slot.productId trong sections).
   * Gọi sau mỗi lần slot được gắn/xoá để storefront load Product cho block renderer.
   */
  private async recomputeArticleProductIds(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { pinnedProductIds: true }
    });
    if (!article) return;
    const sections = await this.prisma.articleSection.findMany({
      where: { articleId },
      select: { blocks: true }
    });
    const slotIds = new Set<string>();
    for (const s of sections) {
      if (!Array.isArray(s.blocks)) continue;
      for (const b of s.blocks as Array<Record<string, unknown>>) {
        if (b?.type === "product_slot" && typeof b.productId === "string") {
          slotIds.add(b.productId);
        }
      }
    }
    const merged = [...new Set([...(article.pinnedProductIds ?? []), ...slotIds])];
    await this.prisma.article.update({
      where: { id: articleId },
      data: { productIds: merged }
    });
  }

  // ──────── Product reviews (manual seed cho V2 Review Scraper) ────────

  @Get("product-reviews")
  async listProductReviews(
    @Query("productId") productId?: string,
    @Query("limit") limit?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const take = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.prisma.productReview.findMany({
      where: productId ? { productId } : undefined,
      orderBy: [{ rating: "desc" }, { reviewDate: "desc" }],
      take
    });
  }

  @Post("product-reviews")
  async createProductReview(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const schema = z.object({
      productId: z.string().uuid(),
      source: z.string().min(1).max(40),
      sourceUrl: z.string().url().nullable().optional(),
      author: z.string().max(120).nullable().optional(),
      rating: z.number().min(0).max(5).nullable().optional(),
      title: z.string().max(200).nullable().optional(),
      body: z.string().min(5).max(4000),
      verifiedBuyer: z.boolean().optional(),
      reviewDate: z.string().datetime().nullable().optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).nullable().optional(),
      topicTags: z.array(z.string()).max(20).optional()
    });
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    return this.prisma.productReview.create({
      data: {
        productId: parsed.data.productId,
        source: parsed.data.source,
        sourceUrl: parsed.data.sourceUrl ?? null,
        author: parsed.data.author ?? null,
        rating: parsed.data.rating ?? null,
        title: parsed.data.title ?? null,
        body: parsed.data.body,
        verifiedBuyer: parsed.data.verifiedBuyer ?? false,
        reviewDate: parsed.data.reviewDate ? new Date(parsed.data.reviewDate) : null,
        sentiment: parsed.data.sentiment ?? null,
        topicTags: parsed.data.topicTags ?? []
      }
    });
  }

  @Delete("product-reviews/:id")
  async deleteProductReview(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    await this.prisma.productReview.delete({ where: { id } });
    return { success: true };
  }

  // ──────── Authors ────────

  @Get("authors")
  async listAuthors(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.prisma.author.findMany({ orderBy: { name: "asc" } });
  }

  @Post("authors")
  async createAuthor(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const schema = z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(80),
      name: z.string().min(2).max(120),
      bio: z.string().max(2000).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      voiceProfile: z.record(z.unknown()),
      expertiseNiches: z.array(z.string().uuid()).max(50).optional(),
      isActive: z.boolean().optional()
    });
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    return this.prisma.author.create({
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        bio: parsed.data.bio ?? null,
        avatarUrl: parsed.data.avatarUrl ?? null,
        voiceProfile: parsed.data.voiceProfile as Prisma.InputJsonValue,
        expertiseNiches: parsed.data.expertiseNiches ?? [],
        isActive: parsed.data.isActive ?? true
      }
    });
  }

  @Put("authors/:id")
  async updateAuthor(
    @Param("id") id: string,
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const schema = z.object({
      name: z.string().min(2).max(120).optional(),
      bio: z.string().max(2000).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      voiceProfile: z.record(z.unknown()).optional(),
      expertiseNiches: z.array(z.string().uuid()).max(50).optional(),
      isActive: z.boolean().optional()
    });
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    const data: Prisma.AuthorUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
    if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.voiceProfile !== undefined) data.voiceProfile = parsed.data.voiceProfile as Prisma.InputJsonValue;
    if (parsed.data.expertiseNiches !== undefined) data.expertiseNiches = { set: parsed.data.expertiseNiches };
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    return this.prisma.author.update({ where: { id }, data });
  }

  @Delete("authors/:id")
  async deleteAuthor(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    await this.prisma.author.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================================================
  // at-money-flows-v1 endpoints
  // ==========================================================================

  // --- STORY-02: sync status + manual orchestration ---

  @Get("sync/status")
  async getSyncStatus(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const rows = await this.prisma.lastSyncStatus.findMany({ orderBy: { name: "asc" } });
    const now = Date.now();
    return rows.map((r) => {
      const lastSuccess = r.lastSuccessAt?.getTime() ?? 0;
      const threshold = r.expectedFrequencySec * 2 * 1000;
      const isStale = lastSuccess === 0 || now - lastSuccess > threshold;
      const ageSec = lastSuccess > 0 ? Math.floor((now - lastSuccess) / 1000) : null;
      return {
        name: r.name,
        lastRunAt: r.lastRunAt,
        lastSuccessAt: r.lastSuccessAt,
        lastError: r.lastError,
        lastDurationMs: r.lastDurationMs,
        lastResult: r.lastResult,
        expectedFrequencySec: r.expectedFrequencySec,
        isStale,
        ageSec
      };
    });
  }

  @Post("sync/all")
  async syncAll(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);

    const runners: Array<[SyncName, () => Promise<unknown>]> = [
      ["crawler", () => this.crawler.runFullCycle("manual")],
      ["reconcile", () => this.reconciliation.runReconcileCycle("manual")],
      ["coupon", () => this.couponSync.syncFromAccesstrade()],
      ["top_products", () => this.topProducts.syncDailySnapshot()]
    ];

    const results: Record<string, { ok: boolean; ms: number; data?: unknown; error?: string }> = {};
    for (const [name, run] of runners) {
      const t0 = Date.now();
      try {
        const data = await run();
        results[name] = { ok: true, ms: Date.now() - t0, data };
      } catch (err: unknown) {
        results[name] = {
          ok: false,
          ms: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err)
        };
      }
      // Sleep 1.5s giữa endpoint để né AT rate-limit.
      await new Promise((r) => setTimeout(r, 1500));
    }

    const totalMs = Object.values(results).reduce((s, r) => s + r.ms, 0);
    return { ok: true, totalMs, results };
  }

  @Post("sync/:name")
  async syncOne(
    @Param("name") name: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    if (!SYNC_NAMES.includes(name as SyncName)) {
      throw new HttpException(`Unknown sync name: ${name}`, HttpStatus.BAD_REQUEST);
    }
    const t0 = Date.now();
    try {
      let data: unknown;
      switch (name as SyncName) {
        case "crawler":
          data = await this.crawler.runFullCycle("manual");
          break;
        case "reconcile":
          data = await this.reconciliation.runReconcileCycle("manual");
          break;
        case "coupon":
          data = await this.couponSync.syncFromAccesstrade();
          break;
        case "top_products":
          data = await this.topProducts.syncDailySnapshot();
          break;
      }
      return { ok: true, ms: Date.now() - t0, data };
    } catch (err: unknown) {
      throw new HttpException(
        err instanceof Error ? err.message : String(err),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // --- STORY-03: dashboard helpers ---

  @Get("queues/counts")
  async getQueueCounts(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const [refinery, articlesPending, couponsPending] = await Promise.all([
      this.prisma.productExtraction.count({
        where: { status: "PENDING_REVIEW", autoApproved: false }
      }),
      this.prisma.article.count({ where: { status: "PENDING_REVIEW" } }),
      this.prisma.coupon.count({ where: { isActive: false } })
    ]);
    return { refinery, articlesPending, couponsPending };
  }

  @Get("kpi/summary")
  async getKpiSummary(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const now = new Date();
    const yStart = new Date(now);
    yStart.setDate(yStart.getDate() - 1);
    yStart.setHours(0, 0, 0, 0);
    const yEnd = new Date(yStart);
    yEnd.setDate(yEnd.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [yClicks, yOrders, yRevenue, mClicks, mOrders, mRevenue] = await Promise.all([
      this.prisma.clickLog.count({ where: { createdAt: { gte: yStart, lt: yEnd } } }),
      this.prisma.conversionWebhook.count({ where: { receivedAt: { gte: yStart, lt: yEnd } } }),
      this.prisma.conversionWebhook.aggregate({
        _sum: { revenue: true },
        where: { receivedAt: { gte: yStart, lt: yEnd } }
      }),
      this.prisma.clickLog.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.conversionWebhook.count({ where: { receivedAt: { gte: monthStart } } }),
      this.prisma.conversionWebhook.aggregate({
        _sum: { revenue: true },
        where: { receivedAt: { gte: monthStart } }
      })
    ]);

    return {
      yesterday: {
        clicks: yClicks,
        orders: yOrders,
        revenue: Number(yRevenue._sum.revenue ?? 0)
      },
      month: {
        clicks: mClicks,
        orders: mOrders,
        revenue: Number(mRevenue._sum.revenue ?? 0)
      }
    };
  }

  // --- STORY-05: real-bestseller insight ---

  @Get("insights/real-bestseller")
  async getRealBestseller(
    @Query("days") days?: string,
    @Query("nicheSlug") nicheSlug?: string,
    @Query("limit") limit?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.realBestseller.getTopReal({
      days: days ? parseInt(days, 10) : 7,
      nicheSlug,
      limit: limit ? parseInt(limit, 10) : 10
    });
  }

  // --- STORY-06: money trail by channel ---

  @Get("money-trail/channels")
  async getMoneyTrailChannels(
    @Query("days") days?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.moneyTrail.getByChannel({ days: days ? parseInt(days, 10) : 7 });
  }

  // --- STORY-09: refinery v2 (bulk approve + un-approve) ---
  // NB: path `refinery-queue` (không phải `refinery/queue`) để né conflict với
  // `@Get("refinery/:id")` đã đăng ký trước trong controller này (Nest match `:id` literal trước).

  @Get("refinery-queue")
  async listRefineryQueue(
    @Query("tab") tab?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const safeTab = (["human", "auto", "all"].includes(tab ?? "") ? tab : "human") as
      | "human"
      | "auto"
      | "all";
    return this.refinery.listExtractions({ tab: safeTab });
  }

  @Post("refinery/bulk-approve")
  async refineryBulkApprove(
    @Body() payload: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = bulkApproveSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const approved = await this.refinery.bulkApprove(parsed.data.ids, role);
    return { ok: true, approved };
  }

  @Post("refinery/:id/unapprove")
  async refineryUnapprove(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    await this.refinery.unapprove(id);
    return { ok: true };
  }

  // --- STORY-10: article wizard helpers ---

  @Get("articles/suggest-products")
  async suggestArticleProducts(
    @Query("nicheSlug") nicheSlug?: string,
    @Query("merchant") merchant?: string,
    @Query("limit") limitRaw?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    if (!nicheSlug) {
      throw new HttpException("nicheSlug required", HttpStatus.BAD_REQUEST);
    }
    const limit = limitRaw ? Math.min(parseInt(limitRaw, 10) || 5, 20) : 5;
    const niche = await this.prisma.niche.findUnique({ where: { slug: nicheSlug } });
    if (!niche) return [];

    // Try real-bestseller first for proven-sales hint, fallback to discount sort.
    const real = await this.realBestseller.getTopReal({ nicheSlug, limit });
    if (real.length >= limit) return real;

    const fallback = await this.prisma.product.findMany({
      where: {
        nicheId: niche.id,
        isPublic: true,
        ...(merchant ? { scrapedData: { path: ["merchant"], equals: merchant } } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { niche: { select: { slug: true, name: true } } }
    });
    return fallback;
  }

  // ============================================================
  // WAITLIST — Epic 0 pre-launch validation
  // ============================================================

  @Get("waitlist")
  async listWaitlist(
    @Query("nicheSlug") nicheSlug?: string,
    @Query("limit") limit?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const take = Math.min(Math.max(Number(limit ?? 200), 1), 1000);
    return this.prisma.waitlistSignup.findMany({
      where: nicheSlug ? { nicheSlug } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      include: { niche: { select: { name: true, slug: true, status: true } } }
    });
  }

  @Get("waitlist/stats")
  async waitlistStats(
    @Query("nicheSlug") nicheSlug?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const where = nicheSlug ? { nicheSlug } : {};

    const [total, byNicheGroup, bySourceGroup, bySurveyGroup, recent7d] = await Promise.all([
      this.prisma.waitlistSignup.count({ where }),
      this.prisma.waitlistSignup.groupBy({
        by: ["nicheSlug"],
        _count: { _all: true },
        where,
        orderBy: { _count: { nicheSlug: "desc" } }
      }),
      this.prisma.waitlistSignup.groupBy({
        by: ["source"],
        _count: { _all: true },
        where,
        orderBy: { _count: { source: "desc" } }
      }),
      this.prisma.waitlistSignup.groupBy({
        by: ["surveyAnswer"],
        _count: { _all: true },
        where: { ...where, surveyAnswer: { not: null } },
        orderBy: { _count: { surveyAnswer: "desc" } }
      }),
      this.prisma.waitlistSignup.count({
        where: { ...where, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      })
    ]);

    return {
      total,
      recent7d,
      byNiche: byNicheGroup.map((g) => ({ nicheSlug: g.nicheSlug, count: g._count._all })),
      bySource: bySourceGroup.map((g) => ({ source: g.source ?? "(unknown)", count: g._count._all })),
      bySurvey: bySurveyGroup.map((g) => ({
        answer: g.surveyAnswer ?? "(blank)",
        count: g._count._all
      }))
    };
  }

  @Delete("waitlist/:id")
  async deleteWaitlistEntry(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    try {
      await this.prisma.waitlistSignup.delete({ where: { id } });
      return { success: true };
    } catch (error: unknown) {
      this.logger.error("Failed to delete waitlist entry", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to delete", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ============================================================
  // TOOL BUILDER — Epic 2 AI-visible decision engine
  // ============================================================

  @Get("tools")
  async listTools(
    @Query("nicheId") nicheId?: string,
    @Query("status") status?: "DRAFT" | "PUBLISHED" | "ARCHIVED",
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    return this.prisma.tool.findMany({
      where: {
        ...(nicheId ? { nicheId } : {}),
        ...(status ? { status } : {})
      },
      include: {
        niche: { select: { slug: true, name: true, status: true } },
        _count: { select: { sessions: true, clickLogs: true } }
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  @Get("tools/:id")
  async getTool(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: {
        niche: { select: { id: true, slug: true, name: true, status: true, schemaConfig: true } },
        _count: { select: { sessions: true, clickLogs: true } }
      }
    });
    if (!tool) {
      throw new HttpException("Tool not found", HttpStatus.NOT_FOUND);
    }
    return tool;
  }

  @Post("tools")
  async createTool(
    @Body() body: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = toolCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.prisma.tool.create({
        data: {
          slug: parsed.data.slug,
          nicheId: parsed.data.nicheId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          tagline: parsed.data.tagline ?? null,
          quizSchema: parsed.data.quizSchema as Prisma.InputJsonValue,
          scoringRules: parsed.data.scoringRules as Prisma.InputJsonValue,
          resultTemplate: parsed.data.resultTemplate as Prisma.InputJsonValue,
          status: "DRAFT",
          seoTitle: parsed.data.seoTitle ?? null,
          seoDescription: parsed.data.seoDescription ?? null
        }
      });
    } catch (error: unknown) {
      this.logger.error("Failed to create Tool", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to create tool (slug đã tồn tại?)", HttpStatus.BAD_REQUEST);
    }
  }

  @Put("tools/:id")
  async updateTool(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const parsed = toolUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data: Prisma.ToolUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.tagline !== undefined) data.tagline = parsed.data.tagline;
    if (parsed.data.quizSchema !== undefined)
      data.quizSchema = parsed.data.quizSchema as Prisma.InputJsonValue;
    if (parsed.data.scoringRules !== undefined)
      data.scoringRules = parsed.data.scoringRules as Prisma.InputJsonValue;
    if (parsed.data.resultTemplate !== undefined)
      data.resultTemplate = parsed.data.resultTemplate as Prisma.InputJsonValue;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.seoTitle !== undefined) data.seoTitle = parsed.data.seoTitle;
    if (parsed.data.seoDescription !== undefined) data.seoDescription = parsed.data.seoDescription;

    try {
      return await this.prisma.tool.update({ where: { id }, data });
    } catch (error: unknown) {
      this.logger.error("Failed to update Tool", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to update tool", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post("tools/:id/publish")
  async publishTool(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    return this.prisma.tool.update({ where: { id }, data: { status: "PUBLISHED" } });
  }

  @Post("tools/:id/archive")
  async archiveTool(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    return this.prisma.tool.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  @Delete("tools/:id")
  async deleteTool(
    @Param("id") id: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    const sessionCount = await this.prisma.quizSession.count({ where: { toolId: id } });
    if (sessionCount > 0) {
      throw new HttpException(
        `Không xoá được — Tool đã có ${sessionCount} session. Hãy archive thay vì delete.`,
        HttpStatus.CONFLICT
      );
    }
    await this.prisma.tool.delete({ where: { id } });
    return { success: true };
  }

  @Post("tools/:id/preview-score")
  async previewToolScore(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["reviewer", "admin"]);
    const parsed = previewScoreSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }

    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: { niche: { select: { id: true } } }
    });
    if (!tool) throw new HttpException("Tool not found", HttpStatus.NOT_FOUND);

    const products = await this.prisma.product.findMany({
      where: { nicheId: tool.niche.id, isPublic: true },
      select: { id: true, name: true, scrapedData: true },
      take: 200
    });

    const scored = this.toolScoring.scoreProducts({
      quizSchema: tool.quizSchema as never,
      scoringRules: tool.scoringRules as never,
      resultTemplate: tool.resultTemplate as never,
      userAttributes: parsed.data.userAttributes,
      products: products.map((p) => ({ id: p.id, name: p.name, scrapedData: p.scrapedData }))
    });

    return {
      ok: true,
      scored,
      products: products
        .filter((p) => scored.some((s) => s.productId === p.id))
        .map((p) => ({ id: p.id, name: p.name, scrapedData: p.scrapedData }))
    };
  }

  @Post("tools/inventory-check")
  async runInventoryCheck(
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["admin"]);
    try {
      const result = await this.inventoryCheck.runCheck();
      return { success: true, ...result };
    } catch (error: unknown) {
      this.logger.error(
        "Inventory check failed",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException("Inventory check failed", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get("tools/:id/analytics")
  async toolAnalytics(
    @Param("id") id: string,
    @Query("days") days?: string,
    @Headers("x-admin-role") role?: string,
    @Headers("x-admin-key") apiKey?: string
  ) {
    this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);

    const daysNum = Math.min(Math.max(Number(days ?? 30), 1), 365);
    const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: { niche: { select: { slug: true, name: true } } }
    });
    if (!tool) throw new HttpException("Tool not found", HttpStatus.NOT_FOUND);

    const [totalSessions, sessionsInRange, chatSessions, totalClicks, conversions, bySource, topProducts] =
      await Promise.all([
        this.prisma.quizSession.count({ where: { toolId: id } }),
        this.prisma.quizSession.count({ where: { toolId: id, createdAt: { gte: since } } }),
        this.prisma.quizSession.count({
          where: {
            toolId: id,
            createdAt: { gte: since },
            userInput: { path: ["mode"], equals: "chat" }
          }
        }),
        this.prisma.clickLog.count({ where: { toolId: id, createdAt: { gte: since } } }),
        this.prisma.conversionWebhook.count({
          where: {
            clickLog: { toolId: id },
            receivedAt: { gte: since }
          }
        }),
        this.prisma.quizSession.groupBy({
          by: ["source"],
          _count: { _all: true },
          where: { toolId: id, createdAt: { gte: since } },
          orderBy: { _count: { source: "desc" } }
        }),
        this.prisma.clickLog.groupBy({
          by: ["productId"],
          _count: { _all: true },
          where: { toolId: id, createdAt: { gte: since } },
          orderBy: { _count: { productId: "desc" } },
          take: 5
        })
      ]);

    const productIds = topProducts.map((p) => p.productId);
    const productDetails =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, slug: true }
          })
        : [];

    const clickRate = sessionsInRange > 0 ? (totalClicks / sessionsInRange) * 100 : 0;
    const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

    return {
      tool: { id: tool.id, name: tool.name, slug: tool.slug, niche: tool.niche, status: tool.status },
      periodDays: daysNum,
      since: since.toISOString(),
      totals: {
        sessionsAllTime: totalSessions,
        sessionsInRange,
        chatSessions,
        quizSessions: sessionsInRange - chatSessions,
        clicks: totalClicks,
        conversions,
        clickRate: Number(clickRate.toFixed(2)),
        conversionRate: Number(conversionRate.toFixed(2))
      },
      bySource: bySource.map((s) => ({ source: s.source ?? "(direct)", count: s._count._all })),
      topProducts: topProducts.map((p) => {
        const d = productDetails.find((pd) => pd.id === p.productId);
        return { productId: p.productId, name: d?.name ?? "(unknown)", slug: d?.slug ?? null, clicks: p._count._all };
      })
    };
  }
}

const toolCreateSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug phải lowercase + dash"),
  nicheId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  tagline: z.string().max(200).nullable().optional(),
  quizSchema: z.record(z.unknown()),
  scoringRules: z.record(z.unknown()),
  resultTemplate: z.record(z.unknown()),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional()
});

const previewScoreSchema = z.object({
  userAttributes: z.record(z.unknown())
});

const toolUpdateSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  tagline: z.string().max(200).nullable().optional(),
  quizSchema: z.record(z.unknown()).optional(),
  scoringRules: z.record(z.unknown()).optional(),
  resultTemplate: z.record(z.unknown()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional()
});

function countBlocksWords(blocks: unknown): number {
  if (!Array.isArray(blocks)) return 0;
  const text = blocks
    .map((b) => {
      if (!b || typeof b !== "object") return "";
      const o = b as Record<string, unknown>;
      const parts: string[] = [];
      for (const k of ["markdown", "body", "text", "summary", "claim"]) {
        const v = o[k];
        if (typeof v === "string") parts.push(v);
      }
      return parts.join(" ");
    })
    .join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}
