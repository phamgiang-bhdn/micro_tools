import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArticleType, Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

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
    productId: z.string().min(8),
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
  blocks: z.array(blockSchema).min(3).max(15),
  metaTitle: z.string().max(120).optional().default(""),
  metaDescription: z.string().max(300).optional().default("")
});

export type ArticleAiOutput = z.infer<typeof aiOutputSchema>;

export interface GenerateArticleInput {
  type: ArticleType;
  topic: string;
  toolId?: string | null;
  productIds?: string[];
}

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get modelName(): string {
    return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
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

  async generateDraft(input: GenerateArticleInput): Promise<{
    output: ArticleAiOutput;
    derivedBody: string;
    promptName: string;
    modelName: string;
  }> {
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

    const contextProducts =
      input.productIds && input.productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: input.productIds } },
            select: { id: true, name: true, scrapedData: true, network: true }
          })
        : [];

    const validProductIds = new Set(contextProducts.map((p) => p.id));

    const userBlock = [
      `Chủ đề: ${input.topic}`,
      contextTool ? `Danh mục: ${contextTool.name} (slug: ${contextTool.slug})` : null,
      contextProducts.length > 0
        ? `contextProducts (chỉ dùng productId trong list này, KHÔNG bịa): ${JSON.stringify(
            contextProducts.map((p) => ({
              id: p.id,
              name: p.name,
              network: p.network,
              specs: p.scrapedData
            }))
          )}`
        : "contextProducts: [] (không có sản phẩm — bỏ qua block product_spotlight và comparison)"
    ]
      .filter(Boolean)
      .join("\n\n");

    const fullPrompt = `${promptTemplate.content}\n\n---\n\n${userBlock}`;
    const modelName = this.modelName;

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const maxAttempts = 3;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await model.generateContent(fullPrompt);
        const text = result.response.text();
        const parsedJson = JSON.parse(text) as unknown;
        const validated = aiOutputSchema.safeParse(parsedJson);
        if (!validated.success) {
          throw new Error(`Invalid AI output shape: ${validated.error.message}`);
        }

        // Lọc block có productId/productIds bịa
        const cleanBlocks = filterInvalidProductRefs(validated.data.blocks, validProductIds);

        // Validate ảnh trong product_spotlight (HEAD check, song song, timeout 3s mỗi cái)
        const blocksWithValidImages = await this.validateImageUrls(cleanBlocks);

        const finalOutput: ArticleAiOutput = {
          ...validated.data,
          blocks: blocksWithValidImages
        };

        const derivedBody = blocksToMarkdown(blocksWithValidImages);

        return { output: finalOutput, derivedBody, promptName, modelName };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = message;
        const isRateLimit = /429|rate limit|quota/i.test(message);

        if (isRateLimit && attempt < maxAttempts) {
          const backoffMs = Math.min(60000, attempt * 15000);
          this.logger.warn(
            `Gemini rate limited (article), retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`
          );
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
 * Strip ra các block có productId/productIds AI bịa (không thuộc context).
 * comparison → giữ nếu còn ≥ 2 id hợp lệ; product_spotlight → drop nếu id sai.
 */
function filterInvalidProductRefs(blocks: ArticleBlock[], validIds: Set<string>): ArticleBlock[] {
  return blocks
    .map((b): ArticleBlock | null => {
      if (b.type === "product_spotlight") {
        return validIds.has(b.productId) ? b : null;
      }
      if (b.type === "comparison") {
        const keep = b.productIds.filter((id) => validIds.has(id));
        if (keep.length < 2) return null;
        return { ...b, productIds: keep };
      }
      return b;
    })
    .filter((b): b is ArticleBlock => b !== null);
}

/**
 * Sinh body markdown fallback từ blocks. Dùng cho:
 * - DB column body (NOT NULL)
 * - Sitemap / preview plain text
 * - Fallback render nếu blocks rendering hỏng
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
