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
  Query
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ToolScoringService, ScoreableProduct } from "./scoring.service";
import { ToolAiService } from "./tool-ai.service";
import {
  DEFAULT_RESULT_TEMPLATE,
  ToolQuizSchema,
  ToolResultTemplate,
  ToolScoringRules
} from "./scoring.types";

const submitSessionSchema = z.object({
  toolSlug: z.string().min(1).max(120),
  /** Chat-mode: raw message from user. */
  chatMessage: z.string().max(2000).optional(),
  /** Quiz-mode: { [questionId]: value }. */
  quizAnswers: z.record(z.unknown()).optional(),
  source: z.string().max(60).optional(),
  referrer: z.string().max(500).optional(),
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(1024).optional()
});

@Controller("tool")
export class ToolPublicController {
  private readonly logger = new Logger(ToolPublicController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ToolScoringService,
    private readonly toolAi: ToolAiService
  ) {}

  /** Public: GET /api/v1/tool/by-slug/:slug — return tool config (no AI/scoring). */
  @Get("by-slug/:slug")
  async getToolBySlug(@Param("slug") slug: string) {
    const tool = await this.prisma.tool.findUnique({
      where: { slug },
      include: {
        niche: { select: { slug: true, name: true, status: true } }
      }
    });
    if (!tool || tool.status !== "PUBLISHED" || tool.niche.status !== "ACTIVE") {
      throw new HttpException("Tool not found", HttpStatus.NOT_FOUND);
    }
    return tool;
  }

  /** Public: GET /api/v1/tool/sessions/:id — fetch session result. */
  @Get("sessions/:id")
  async getSession(@Param("id") id: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { id },
      include: {
        tool: {
          include: {
            niche: { select: { slug: true, name: true } }
          }
        }
      }
    });
    if (!session) {
      throw new HttpException("Session not found", HttpStatus.NOT_FOUND);
    }
    return session;
  }

  /** Public: GET by share slug (viral). */
  @Get("share/:shareSlug")
  async getByShareSlug(@Param("shareSlug") shareSlug: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { shareSlug },
      include: { tool: { include: { niche: { select: { slug: true, name: true } } } } }
    });
    if (!session) {
      throw new HttpException("Share link not found", HttpStatus.NOT_FOUND);
    }
    return session;
  }

  /**
   * Public: POST /api/v1/tool/sessions — submit chat hoặc quiz answers.
   * Pipeline (parallel where possible):
   *   1. Load tool + active products
   *   2. Nếu chat mode → AI parse (fail → return need-quiz signal)
   *   3. Scoring engine → top N
   *   4. AI reasoning per product (cached, fallback safe)
   *   5. Persist QuizSession + return result
   */
  @Post("sessions")
  async submitSession(
    @Body() body: unknown,
    @Headers("x-forwarded-for") forwardedFor?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const parsed = submitSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }

    const { toolSlug, chatMessage, quizAnswers, source, referrer } = parsed.data;
    const ipAddress = parsed.data.ipAddress ?? forwardedFor?.split(",")[0]?.trim() ?? "";
    const ipHash = ipAddress ? createHash("sha256").update(ipAddress).digest("hex") : null;
    const ua = parsed.data.userAgent ?? userAgent ?? "";

    // 1. Load tool
    const tool = await this.prisma.tool.findUnique({
      where: { slug: toolSlug },
      include: { niche: { select: { id: true, status: true, slug: true, name: true } } }
    });
    if (!tool || tool.status !== "PUBLISHED" || tool.niche.status !== "ACTIVE") {
      throw new HttpException("Tool not available", HttpStatus.NOT_FOUND);
    }

    const quizSchema = tool.quizSchema as unknown as ToolQuizSchema;
    const scoringRules = tool.scoringRules as unknown as ToolScoringRules;
    const resultTemplate: ToolResultTemplate = {
      ...DEFAULT_RESULT_TEMPLATE,
      ...((tool.resultTemplate as unknown as Partial<ToolResultTemplate>) ?? {})
    };

    // 2. Resolve parsedAttributes
    let parsedAttributes: Record<string, unknown> = {};
    let parseConfidence: Record<string, number> = {};
    let mode: "chat" | "quiz" = "quiz";

    if (chatMessage && chatMessage.trim().length > 0) {
      mode = "chat";
      const parseResult = await this.toolAi.parseUserInput(chatMessage, quizSchema);
      if (!parseResult) {
        return {
          ok: false,
          needsQuiz: true,
          reason: "AI không hiểu được mô tả. Vui lòng dùng quiz."
        };
      }
      parsedAttributes = parseResult.attributes;
      parseConfidence = parseResult.confidence;
    } else if (quizAnswers) {
      parsedAttributes = quizAnswers;
    } else {
      throw new HttpException("Cần chatMessage hoặc quizAnswers", HttpStatus.BAD_REQUEST);
    }

    // 3. Load products của niche
    const products = await this.prisma.product.findMany({
      where: {
        nicheId: tool.niche.id,
        isPublic: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        affiliateUrl: true,
        scrapedData: true,
        network: true
      },
      take: 200
    });

    const scoreable: ScoreableProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      scrapedData: p.scrapedData
    }));

    // 4. Score
    const scored = this.scoring.scoreProducts({
      quizSchema,
      scoringRules,
      resultTemplate,
      userAttributes: parsedAttributes,
      products: scoreable
    });

    // 5. AI reasoning per top product (parallel, all fail-safe)
    const reasonings = await Promise.all(
      scored.map(async (s) => {
        const product = products.find((p) => p.id === s.productId);
        if (!product) return null;
        const r = await this.toolAi.generateReasoning({
          product: { id: product.id, name: product.name, scrapedData: product.scrapedData },
          userAttributes: parsedAttributes,
          matchedCriteria: s.matchedCriteria,
          quizSchema
        });
        return { productId: s.productId, ...r };
      })
    );

    const aiReasonings: Record<
      string,
      { reasoning: string; fromCache: boolean; fromFallback: boolean }
    > = {};
    for (const r of reasonings) {
      if (r) aiReasonings[r.productId] = r;
    }

    // 6. Persist session
    const shareSlug = this.generateShareSlug();
    const reasoningMode = Object.values(aiReasonings).some((r) => !r.fromFallback) ? "ai" : "template";

    const session = await this.prisma.quizSession.create({
      data: {
        toolId: tool.id,
        userInput: {
          mode,
          chatMessage: chatMessage ?? null,
          quizAnswers: (quizAnswers ?? null) as Prisma.InputJsonValue
        } as Prisma.InputJsonValue,
        parsedAttributes: { ...parsedAttributes, _confidence: parseConfidence } as Prisma.InputJsonValue,
        recommendedProductIds: scored.map((s) => s.productId),
        aiReasonings: aiReasonings as Prisma.InputJsonValue,
        source: source ?? null,
        referrer: referrer ?? null,
        ipHash,
        userAgent: ua.slice(0, 1024),
        shareSlug,
        reasoningMode,
        reasoningReadyAt: new Date()
      }
    });

    return {
      ok: true,
      sessionId: session.id,
      shareSlug,
      scored,
      aiReasonings,
      products: products
        .filter((p) => scored.some((s) => s.productId === p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          affiliateUrl: p.affiliateUrl,
          scrapedData: p.scrapedData,
          network: p.network
        })),
      resultTemplate
    };
  }

  /** Public: GET /api/v1/tool/active — list PUBLISHED tools (cho homepage hub khi có nhiều niche). */
  @Get("active")
  async listActive(@Query("limit") limit?: string) {
    const take = Math.min(Math.max(Number(limit ?? 20), 1), 50);
    return this.prisma.tool.findMany({
      where: {
        status: "PUBLISHED",
        niche: { status: "ACTIVE" }
      },
      include: {
        niche: { select: { slug: true, name: true } }
      },
      orderBy: { updatedAt: "desc" },
      take
    });
  }

  private generateShareSlug(): string {
    return randomBytes(5).toString("base64url").slice(0, 8);
  }
}
