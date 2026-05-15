import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArticleType, Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { ProductDiscoveryService } from "../modules/crawler/product-discovery.service";

const blockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero_quote"),
    text: z.string().min(5).max(400),
    attribution: z.string().max(120).optional()
  }),
  z.object({
    type: z.literal("criteria_grid"),
    title: z.string().max(120).optional(),
    items: z
      .array(
        z.object({
          icon: z.string().max(30).optional(),
          title: z.string().min(2).max(80),
          body: z.string().min(5).max(400)
        })
      )
      .min(2)
      .max(8)
  }),
  z.object({
    type: z.literal("product_spotlight"),
    productId: z.string().min(1),
    angle: z.string().min(3).max(200),
    pros: z.array(z.string()).max(8).optional(),
    cons: z.array(z.string()).max(8).optional(),
    imageUrl: z.string().url().optional()
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "warning", "tip", "success"]),
    title: z.string().min(2).max(120),
    body: z.string().min(5).max(600)
  }),
  z.object({
    type: z.literal("prose"),
    markdown: z.string().min(20)
  }),
  z.object({
    type: z.literal("comparison"),
    productIds: z.array(z.string()).min(2).max(6)
  }),
  z.object({
    type: z.literal("pros_cons"),
    pros: z.array(z.string()).min(1).max(8),
    cons: z.array(z.string()).min(1).max(8)
  }),
  z.object({
    type: z.literal("faq"),
    items: z
      .array(z.object({ q: z.string().min(3), a: z.string().min(5) }))
      .min(1)
      .max(10)
  }),
  z.object({
    type: z.literal("verdict"),
    summary: z.string().min(10).max(800),
    bestFor: z.array(z.string()).max(6).optional(),
    notFor: z.array(z.string()).max(6).optional()
  })
]);

export type ArticleBlock = z.infer<typeof blockSchema>;

const aiOutputSchema = z.object({
  title: z.string().min(5).max(200),
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(300),
  blocks: z.array(blockSchema).min(3).max(20),
  metaTitle: z.string().max(120).optional().default(""),
  metaDescription: z.string().max(300).optional().default(""),
  selectedRefs: z.array(z.string()).max(10).default([]),
  discoveredProducts: z
    .array(
      z.object({
        ref: z.string().min(1).max(40),
        name: z.string().min(2).max(200),
        sourceUrl: z.string().url(),
        reason: z.string().max(300).optional()
      })
    )
    .max(6)
    .default([])
});

export type ArticleAiOutput = z.infer<typeof aiOutputSchema>;

export interface GenerateArticleInput {
  type: ArticleType;
  topic: string;
  toolId?: string | null;
  pinnedProductIds?: string[];
  productRef?: string | null;
}

export interface GeneratedDraft {
  output: ArticleAiOutput;
  derivedBody: string;
  promptName: string;
  modelName: string;
  resolvedProductIds: string[];
  coverImage: string | null;
}

const DEFAULT_ALLOWED_DOMAINS = ["shopee.vn", "tiki.vn", "lazada.vn", "fptshop.com.vn", "thegioididong.com", "dienmayxanh.com"];

const IP_LITERAL_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$|^\[?[0-9a-f:]+\]?$/i;
const PRIVATE_HOST_BLOCKLIST = new Set(["localhost", "metadata.google.internal", "169.254.169.254"]);

export function isSafeDiscoveredUrl(
  rawUrl: string,
  allowedDomains: string[],
  logger?: { warn(msg: string): void }
): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    logger?.warn(`Discovered product invalid URL: ${rawUrl}`);
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    logger?.warn(`Discovered product rejected (bad protocol): ${url.protocol}`);
    return false;
  }
  let host = url.hostname.toLowerCase();
  // Strip trailing dot
  while (host.endsWith(".")) host = host.slice(0, -1);
  host = host.replace(/^www\./, "");
  // Reject IP literals (v4 + v6)
  if (IP_LITERAL_REGEX.test(host)) {
    logger?.warn(`Discovered product rejected (IP literal): ${host}`);
    return false;
  }
  // Reject private/internal hostnames
  if (PRIVATE_HOST_BLOCKLIST.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    logger?.warn(`Discovered product rejected (private host): ${host}`);
    return false;
  }
  // Reject punycode (xn--) — mixed-script homograph attack vector
  if (host.includes("xn--")) {
    logger?.warn(`Discovered product rejected (punycode): ${host}`);
    return false;
  }
  if (!allowedDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
    logger?.warn(`Discovered product rejected (domain not in whitelist): ${host}`);
    return false;
  }
  return true;
}

const candidateSelect = {
  id: true,
  name: true,
  slug: true,
  affiliateUrl: true,
  network: true,
  scrapedData: true,
  updatedAt: true,
  createdAt: true
} satisfies Prisma.ProductSelect;

type CandidateRow = Prisma.ProductGetPayload<{ select: typeof candidateSelect }>;

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: ProductDiscoveryService
  ) {}

  private get modelName(): string {
    return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  private get allowedDomains(): string[] {
    const raw = process.env.ALLOWED_PRODUCT_DOMAINS;
    if (!raw) return DEFAULT_ALLOWED_DOMAINS;
    return raw
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }

  private promptNameFor(type: ArticleType): string {
    switch (type) {
      case "BUYING_GUIDE":
        return "article-buying-guide";
      case "REVIEW":
        return "article-review";
      default:
        throw new HttpException(`Unsupported article type: ${type}`, HttpStatus.BAD_REQUEST);
    }
  }

  async generateDraft(input: GenerateArticleInput): Promise<GeneratedDraft> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpException("GEMINI_API_KEY is not configured", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const promptName = this.promptNameFor(input.type);
    const promptTemplate = await this.prisma.promptTemplate.findFirst({
      where: { name: promptName, isActive: true },
      orderBy: { activatedAt: "desc" }
    });
    if (!promptTemplate) {
      throw new HttpException(
        `No active PromptTemplate named "${promptName}". Activate one in Prompt Studio first.`,
        HttpStatus.PRECONDITION_FAILED
      );
    }

    const contextTool = input.toolId
      ? await this.prisma.tool.findUnique({ where: { id: input.toolId } })
      : null;
    if (!contextTool && input.type === "BUYING_GUIDE") {
      throw new HttpException("BUYING_GUIDE bài cần chọn tool", HttpStatus.BAD_REQUEST);
    }

    const pinnedIds = input.pinnedProductIds ?? [];
    const pinned: CandidateRow[] = pinnedIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: pinnedIds } },
          select: candidateSelect
        })
      : [];

    // Top candidates of the tool (excluding already-pinned)
    const candidatesFromTool: CandidateRow[] = contextTool
      ? await this.prisma.product.findMany({
          where: {
            toolId: contextTool.id,
            id: { notIn: pinnedIds.length ? pinnedIds : ["00000000-0000-0000-0000-000000000000"] }
          },
          select: candidateSelect,
          orderBy: { updatedAt: "desc" },
          take: 15
        })
      : [];

    // For REVIEW: resolve productRef → 1 specific product (always pinned)
    if (input.type === "REVIEW" && input.productRef) {
      const resolvedRef = await this.resolveProductRef(input.productRef, contextTool?.id ?? null);
      if (resolvedRef && !pinned.find((p) => p.id === resolvedRef.id)) {
        pinned.unshift(resolvedRef);
      }
    }

    const candidates = [...pinned, ...candidatesFromTool];
    const refToId = new Map<string, string>();
    const candidateCards = candidates.map((p, i) => {
      const ref = `P${i + 1}`;
      refToId.set(ref, p.id);
      return this.toCandidateCard(p, ref);
    });

    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const seasonHint = this.deriveSeasonHint(month);
    const allowedDomains = this.allowedDomains;

    const pinnedRefs = pinned
      .map((p) => {
        const idx = candidates.findIndex((c) => c.id === p.id);
        return idx >= 0 ? `P${idx + 1}` : null;
      })
      .filter((r): r is string => Boolean(r));

    const userBlock = [
      `[currentDate]: ${currentDate} (writing for Vietnam market in ${month}/${year}, season: ${seasonHint})`,
      `[topic]: ${input.topic}`,
      contextTool ? `[tool]: ${contextTool.name} (slug: ${contextTool.slug})` : null,
      `[allowedDomains]: ${allowedDomains.join(", ")}`,
      pinnedRefs.length > 0 ? `[pinnedRefs] (BẮT BUỘC dùng tất cả trong block product_spotlight): ${pinnedRefs.join(", ")}` : null,
      `[candidates] (DÙNG ref P1, P2... trong productId/productIds/selectedRefs):\n${JSON.stringify(candidateCards, null, 2)}`,
      `\n=== QUY TẮC BẮT BUỘC ===`,
      `1. Khi nhắc tới sản phẩm trong block product_spotlight (field "productId") và comparison (field "productIds"), BẮT BUỘC ĐIỀN REF (vd "P1","P2","D1") — KHÔNG điền UUID. Hệ thống sẽ tự thay ref bằng UUID thật.`,
      `2. Field "selectedRefs" liệt kê các ref đã dùng trong bài (để hệ thống biết bài này gắn sản phẩm nào).`,
      pinnedRefs.length > 0 ? `3a. PHẢI có block product_spotlight cho MỖI ref trong [pinnedRefs] (${pinnedRefs.join(", ")}). Đây là sản phẩm admin pin, không được drop.` : null,
      `3. CHỈ trích giá/khuyến mãi/tính năng từ data trong [candidates]. Không tự suy diễn năm ra mắt cũ hơn ${year - 1}.`,
      `4. Nếu cần thêm sản phẩm KHÔNG có trong [candidates] (vd model mới ra trên thị trường), liệt kê trong "discoveredProducts" với sourceUrl từ web search; ref đặt là D1, D2... và DÙNG ref đó trong block. URL phải nằm trong [allowedDomains].`,
      `5. Giọng văn tươi, sinh động, có hook ở đầu bài. Tránh viết liền 2 prose. Xen kẽ visual block (criteria_grid, product_spotlight, comparison, callout, pros_cons, faq, verdict) để bài đa dạng.`,
      `6. Trả về JSON thuần (không bọc markdown fence). Schema:`,
      `{ "title", "slug", "excerpt", "blocks": [...], "metaTitle", "metaDescription", "selectedRefs": ["P1","D1",...], "discoveredProducts": [{ "ref": "D1", "name", "sourceUrl", "reason" }] }`
    ]
      .filter(Boolean)
      .join("\n\n");

    const fullPrompt = `${promptTemplate.content}\n\n---\n\n${userBlock}`;
    const modelName = this.modelName;

    const client = new GoogleGenerativeAI(apiKey);
    const useGrounding = process.env.ARTICLE_GROUNDING !== "false";
    const model = client.getGenerativeModel({
      model: modelName,
      ...(useGrounding
        ? { tools: [{ googleSearch: {} } as unknown as Record<string, unknown>] as never }
        : { generationConfig: { responseMimeType: "application/json" } })
    });

    const maxAttempts = 3;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await model.generateContent(fullPrompt);
        const rawText = result.response.text();
        const parsedJson = this.extractJson(rawText);
        const validated = aiOutputSchema.safeParse(parsedJson);
        if (!validated.success) {
          throw new Error(`Invalid AI output shape: ${validated.error.message}`);
        }

        // Resolve discoveredProducts → real Product rows (PENDING_REVIEW)
        const discoveredRefToId = await this.ingestDiscovered(
          validated.data.discoveredProducts,
          contextTool?.id ?? null,
          contextTool?.slug ?? null,
          allowedDomains
        );

        const allRefToId = new Map<string, string>([...refToId, ...discoveredRefToId]);

        // Filter blocks with unknown refs
        const cleanBlocks = filterInvalidProductRefs(validated.data.blocks, allRefToId);

        // Replace ref → real productId in blocks for renderer
        const resolvedBlocks = resolveRefsInBlocks(cleanBlocks, allRefToId);

        // Validate images
        const blocksWithValidImages = await this.validateImageUrls(resolvedBlocks);

        // Stale-year hint reject (soft, retry once if too old)
        if (attempt === 1 && this.hasStaleYearMention(blocksWithValidImages, year)) {
          this.logger.warn("Article mentions stale year, retrying once");
          throw new Error("STALE_YEAR_RETRY");
        }

        const finalOutput: ArticleAiOutput = {
          ...validated.data,
          blocks: blocksWithValidImages
        };

        const derivedBody = blocksToMarkdown(blocksWithValidImages);

        // Compute resolvedProductIds: refs used in selectedRefs + all refs found in blocks
        // After resolveRefsInBlocks(), block fields already contain UUIDs (not refs),
        // so we re-derive from the original (pre-resolve) cleanBlocks via reverse mapping.
        const usedRefs = new Set<string>(validated.data.selectedRefs);
        for (const b of cleanBlocks) {
          if (b.type === "product_spotlight") usedRefs.add(b.productId);
          if (b.type === "comparison") b.productIds.forEach((r) => usedRefs.add(r));
        }
        const resolvedProductIds = Array.from(usedRefs)
          .map((r) => allRefToId.get(r))
          .filter((id): id is string => Boolean(id));

        const coverImage = await this.pickCoverImage(resolvedProductIds);

        return { output: finalOutput, derivedBody, promptName, modelName, resolvedProductIds, coverImage };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = message;
        const isRateLimit = /429|rate limit|quota/i.test(message);
        const isStaleRetry = message === "STALE_YEAR_RETRY";

        if ((isRateLimit || isStaleRetry) && attempt < maxAttempts) {
          const backoffMs = isStaleRetry ? 500 : Math.min(60000, attempt * 15000);
          if (isRateLimit) {
            this.logger.warn(
              `Gemini rate limited (article), retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        if (isRateLimit) {
          throw new HttpException(
            "Gemini API rate limit exceeded after retries",
            HttpStatus.TOO_MANY_REQUESTS
          );
        }

        this.logger.error("Article AI generation failed", message);
        throw new HttpException(`Article generation failed: ${message}`, HttpStatus.BAD_GATEWAY);
      }
    }

    throw new HttpException(
      `Unexpected article AI generation state: ${lastError ?? "unknown"}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  private toCandidateCard(p: CandidateRow, ref: string): Record<string, unknown> {
    const data = (p.scrapedData ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
    const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
    return {
      ref,
      name: p.name,
      price: num(data.price ?? data.currentPrice ?? data.salePrice),
      originalPrice: num(data.originalPrice),
      discountPercent: num(data.discountPercent),
      brand: str(data.brand),
      store: str(data.store),
      image: str(data.image ?? data.imageUrl ?? data.thumbnail),
      description: str(data.description)?.slice(0, 300),
      crawledAt: p.createdAt.toISOString().slice(0, 10),
      priceUpdatedAt: p.updatedAt.toISOString().slice(0, 10)
    };
  }

  private async resolveProductRef(ref: string, toolId: string | null): Promise<CandidateRow | null> {
    const trimmed = ref.trim();
    if (!trimmed) return null;
    const isUrl = /^https?:\/\//i.test(trimmed);
    if (isUrl) {
      return this.prisma.product.findFirst({
        where: { affiliateUrl: trimmed },
        select: candidateSelect
      });
    }
    return this.prisma.product.findFirst({
      where: {
        ...(toolId ? { toolId } : {}),
        OR: [{ slug: trimmed }, { name: { contains: trimmed, mode: "insensitive" } }]
      },
      select: candidateSelect
    });
  }

  private async ingestDiscovered(
    discovered: ArticleAiOutput["discoveredProducts"],
    toolId: string | null,
    toolSlug: string | null,
    allowedDomains: string[]
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!toolId || !toolSlug || discovered.length === 0) return out;

    for (const item of discovered) {
      if (!isSafeDiscoveredUrl(item.sourceUrl, allowedDomains, this.logger)) continue;

      try {
        const productId = await this.discovery.ingest({
          name: item.name,
          sourceUrl: item.sourceUrl,
          toolId,
          toolSlug,
          reason: item.reason
        });
        if (productId) out.set(item.ref, productId);
      } catch (e) {
        this.logger.warn(`Failed to ingest discovered product ${item.name}: ${(e as Error).message}`);
      }
    }
    return out;
  }

  private async pickCoverImage(productIds: string[]): Promise<string | null> {
    if (productIds.length === 0) return null;
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, scrapedData: true }
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const id of productIds) {
      const p = byId.get(id);
      if (!p) continue;
      const data = (p.scrapedData ?? {}) as Record<string, unknown>;
      const img = (data.image ?? data.imageUrl ?? data.thumbnail) as string | undefined;
      if (typeof img === "string" && img.startsWith("http")) return img;
    }
    return null;
  }

  private deriveSeasonHint(month: number): string {
    if (month === 1 || month === 2) return "Tết Nguyên Đán";
    if (month === 11) return "11.11 / Black Friday";
    if (month === 12) return "Cuối năm / 12.12";
    if (month >= 6 && month <= 8) return "Mùa hè";
    if (month === 9) return "Tựu trường";
    return "Bình thường";
  }

  private extractJson(text: string): unknown {
    const cleaned = text
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to find first { and last }
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error("AI response was not valid JSON");
    }
  }

  private hasStaleYearMention(blocks: ArticleBlock[], currentYear: number): boolean {
    const cutoff = currentYear - 2;
    const yearRegex = /\b(19\d\d|20\d\d)\b/g;
    const scan = (text: string): boolean => {
      for (const m of text.matchAll(yearRegex)) {
        const y = Number(m[1]);
        if (Number.isFinite(y) && y < cutoff) return true;
      }
      return false;
    };
    for (const b of blocks) {
      if (b.type === "prose" && scan(b.markdown)) return true;
      if (b.type === "callout" && scan(b.body)) return true;
      if (b.type === "verdict" && scan(b.summary)) return true;
    }
    return false;
  }

  private async validateImageUrls(blocks: ArticleBlock[]): Promise<ArticleBlock[]> {
    const urlsToCheck = new Set<string>();
    for (const b of blocks) {
      if (b.type === "product_spotlight" && b.imageUrl) urlsToCheck.add(b.imageUrl);
    }
    if (urlsToCheck.size === 0) return blocks;

    const results = await Promise.allSettled(
      Array.from(urlsToCheck).map((url) => this.headCheckImage(url))
    );

    const validUrls = new Set<string>();
    Array.from(urlsToCheck).forEach((url, i) => {
      const r = results[i];
      if (r.status === "fulfilled" && r.value) validUrls.add(url);
    });

    return blocks.map((b) => {
      if (b.type === "product_spotlight" && b.imageUrl && !validUrls.has(b.imageUrl)) {
        const { imageUrl: _drop, ...rest } = b;
        return rest as ArticleBlock;
      }
      return b;
    });
  }

  private async headCheckImage(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
      clearTimeout(timeout);
      if (!res.ok) return false;
      const ct = res.headers.get("content-type") ?? "";
      return ct.startsWith("image/");
    } catch {
      return false;
    }
  }

  async ensureUniqueSlug(candidate: string, excludeId?: string): Promise<string> {
    let slug = candidate;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.article.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) return slug;
      suffix += 1;
      slug = `${candidate}-${suffix}`;
      if (suffix > 50) {
        // Race fallback — append timestamp to break the loop
        return `${candidate}-${Date.now().toString(36)}`;
      }
    }
  }

  asProductIdsArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id));
  }

  toPrismaJsonArray(productIds: string[]): Prisma.ArticleCreateInput["productIds"] {
    return productIds;
  }
}

/**
 * Strip blocks referencing unknown refs. After this pass, every ref is guaranteed valid.
 */
function filterInvalidProductRefs(blocks: ArticleBlock[], validRefs: Map<string, string>): ArticleBlock[] {
  return blocks
    .map((b): ArticleBlock | null => {
      if (b.type === "product_spotlight") {
        return validRefs.has(b.productId) ? b : null;
      }
      if (b.type === "comparison") {
        const keep = b.productIds.filter((r) => validRefs.has(r));
        if (keep.length < 2) return null;
        return { ...b, productIds: keep };
      }
      return b;
    })
    .filter((b): b is ArticleBlock => b !== null);
}

/**
 * Replace ref strings (P1, D1) with real productId UUIDs in blocks.
 * Renderer downstream consumes productId.
 */
function resolveRefsInBlocks(blocks: ArticleBlock[], refToId: Map<string, string>): ArticleBlock[] {
  return blocks.map((b) => {
    if (b.type === "product_spotlight") {
      const id = refToId.get(b.productId);
      return { ...b, productId: id ?? b.productId } as ArticleBlock;
    }
    if (b.type === "comparison") {
      const ids = b.productIds.map((r) => refToId.get(r) ?? r);
      return { ...b, productIds: ids } as ArticleBlock;
    }
    return b;
  });
}

/**
 * Markdown fallback (body NOT NULL column). Refs already resolved to UUIDs here,
 * but we don't dereference — body is for SEO plaintext fallback, not detailed render.
 */
export function blocksToMarkdown(blocks: ArticleBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "hero_quote":
        parts.push(`> ${b.text}${b.attribution ? `\n>\n> — ${b.attribution}` : ""}`);
        break;
      case "criteria_grid":
        if (b.title) parts.push(`## ${b.title}`);
        for (const item of b.items) parts.push(`### ${item.title}\n\n${item.body}`);
        break;
      case "product_spotlight":
        parts.push(`### ${b.angle}`);
        if (b.pros?.length) parts.push(b.pros.map((p) => `- ${p}`).join("\n"));
        if (b.cons?.length) parts.push(b.cons.map((c) => `- ${c}`).join("\n"));
        break;
      case "callout":
        parts.push(`> **${b.title}**\n> ${b.body}`);
        break;
      case "prose":
        parts.push(b.markdown);
        break;
      case "comparison":
        parts.push(`*So sánh ${b.productIds.length} sản phẩm.*`);
        break;
      case "pros_cons":
        parts.push(`**Ưu điểm:**\n${b.pros.map((p) => `- ${p}`).join("\n")}`);
        parts.push(`**Nhược điểm:**\n${b.cons.map((c) => `- ${c}`).join("\n")}`);
        break;
      case "faq":
        parts.push("## Câu hỏi thường gặp");
        for (const item of b.items) parts.push(`**${item.q}**\n\n${item.a}`);
        break;
      case "verdict":
        parts.push(`## Kết luận\n\n${b.summary}`);
        if (b.bestFor?.length) parts.push(`**Phù hợp với:**\n${b.bestFor.map((p) => `- ${p}`).join("\n")}`);
        if (b.notFor?.length) parts.push(`**Không phù hợp với:**\n${b.notFor.map((p) => `- ${p}`).join("\n")}`);
        break;
    }
  }
  return parts.join("\n\n");
}
