import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArticleType, Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

const aiOutputSchema = z.object({
  title: z.string().min(5).max(200),
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(300),
  body: z.string().min(50),
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

    const userBlock = [
      `Chủ đề: ${input.topic}`,
      contextTool ? `Danh mục: ${contextTool.name} (slug: ${contextTool.slug})` : null,
      contextProducts.length > 0
        ? `contextProducts: ${JSON.stringify(
            contextProducts.map((p) => ({
              name: p.name,
              network: p.network,
              specs: p.scrapedData
            }))
          )}`
        : null
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
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await model.generateContent(fullPrompt);
        const text = result.response.text();
        const parsedJson = JSON.parse(text) as unknown;
        const validated = aiOutputSchema.safeParse(parsedJson);
        if (!validated.success) {
          throw new Error(`Invalid AI output shape: ${validated.error.message}`);
        }
        return { output: validated.data, promptName, modelName };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
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

    throw new HttpException("Unexpected article AI generation state", HttpStatus.INTERNAL_SERVER_ERROR);
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
