import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { AiService } from "../../services/ai.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ScoreableProduct } from "./scoring.service";
import { MatchedCriterion, ToolQuizSchema } from "./scoring.types";

/**
 * Wraps AiService cho Tool-specific use cases:
 *  1. parseUserInput   — chat tự nhiên → structured attributes
 *  2. generateReasoning — (product × user profile) → 1-2 câu giải thích
 *
 * Cả 2 đều graceful fallback: AI fail → return null, UI hiện template/quiz path.
 * Khác philosophy [[feedback_no_ai_retry]] (extraction = 1-shot, fail = stop):
 * Tool là user-facing realtime → bắt buộc fallback, không thể trắng màn.
 */
@Injectable()
export class ToolAiService {
  private readonly logger = new Logger(ToolAiService.name);

  constructor(private readonly ai: AiService, private readonly prisma: PrismaService) {}

  /**
   * Parse câu user mô tả nhu cầu → structured attributes khớp quizSchema.
   * Fail → null (UI fallback sang quiz step-by-step).
   */
  async parseUserInput(
    userMessage: string,
    quizSchema: ToolQuizSchema
  ): Promise<{ attributes: Record<string, unknown>; confidence: Record<string, number> } | null> {
    if (!userMessage || userMessage.trim().length < 5) {
      return null;
    }

    const prompt = await this.getPromptOrDefault(
      "tool.parseUserInput",
      DEFAULT_PARSE_PROMPT
    );

    const schemaDescription = quizSchema.questions
      .map((q) => {
        const opts = q.options?.map((o) => `"${o.value}" (${o.label})`).join(", ") ?? "";
        const range = q.type === "number" || q.type === "range" ? ` [min=${q.min ?? ""}, max=${q.max ?? ""}]` : "";
        return `- ${q.id} (${q.type}${range})${opts ? ` choices: ${opts}` : ""}: ${q.question}`;
      })
      .join("\n");

    const fullPrompt = prompt
      .replace("{schemaDescription}", schemaDescription)
      .replace("{userMessage}", userMessage.slice(0, 2000));

    try {
      const result = await this.ai.generateJson<{
        attributes: Record<string, unknown>;
        confidence: Record<string, number>;
      }>(fullPrompt);
      if (!result || typeof result !== "object" || !result.attributes) {
        this.logger.warn("parseUserInput returned invalid shape", result as object);
        return null;
      }
      return {
        attributes: result.attributes,
        confidence: result.confidence ?? {}
      };
    } catch (error: unknown) {
      this.logger.warn(
        "parseUserInput AI failed → returning null",
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Sinh reasoning 1-2 câu giải thích vì sao product hợp với user.
   * Cache theo (productId × profileHash × model) — TTL 30 ngày.
   * Fail → template fallback từ matchedCriteria.
   */
  async generateReasoning(args: {
    product: ScoreableProduct;
    userAttributes: Record<string, unknown>;
    matchedCriteria: MatchedCriterion[];
    quizSchema: ToolQuizSchema;
  }): Promise<{ reasoning: string; fromCache: boolean; fromFallback: boolean }> {
    const profileHash = this.hashProfile(args.userAttributes);
    const model = this.ai.currentModel;

    // Cache lookup.
    try {
      const cached = await this.prisma.reasoningCache.findUnique({
        where: {
          productId_profileHash_model: {
            productId: args.product.id,
            profileHash,
            model
          }
        }
      });
      if (cached) {
        await this.prisma.reasoningCache.update({
          where: { id: cached.id },
          data: { hitCount: { increment: 1 }, lastHitAt: new Date() }
        });
        return { reasoning: cached.reasoning, fromCache: true, fromFallback: false };
      }
    } catch (error: unknown) {
      this.logger.warn(
        "reasoning cache lookup failed",
        error instanceof Error ? error.message : String(error)
      );
    }

    // AI generate.
    try {
      const prompt = await this.getPromptOrDefault(
        "tool.generateReasoning",
        DEFAULT_REASONING_PROMPT
      );

      const matchedLines = args.matchedCriteria
        .filter((c) => c.matched)
        .map((c) => `- ${c.label} (weight ${c.weight})`)
        .join("\n");
      const unmatchedLines = args.matchedCriteria
        .filter((c) => !c.matched)
        .map((c) => `- ${c.label}`)
        .join("\n");

      const userProfile = args.quizSchema.questions
        .map((q) => {
          const val = args.userAttributes[q.id];
          if (val === undefined || val === null || val === "") return null;
          return `- ${q.question} → ${JSON.stringify(val)}`;
        })
        .filter(Boolean)
        .join("\n");

      const productSummary = JSON.stringify(
        {
          name: args.product.name,
          ...(typeof args.product.scrapedData === "object" && args.product.scrapedData !== null
            ? args.product.scrapedData
            : {})
        },
        null,
        2
      ).slice(0, 1500);

      const fullPrompt = prompt
        .replace("{productSummary}", productSummary)
        .replace("{userProfile}", userProfile || "(không có thông tin)")
        .replace("{matched}", matchedLines || "(không có)")
        .replace("{unmatched}", unmatchedLines || "(không có)");

      const result = await this.ai.generateJson<{ reasoning: string }>(fullPrompt);
      const reasoning = (result?.reasoning ?? "").trim();

      if (!reasoning || reasoning.length < 10) {
        return {
          reasoning: this.fallbackReasoning(args.matchedCriteria),
          fromCache: false,
          fromFallback: true
        };
      }

      // Save cache (fire-and-forget — don't block response).
      this.prisma.reasoningCache
        .create({
          data: {
            productId: args.product.id,
            profileHash,
            reasoning,
            model
          }
        })
        .catch((err: unknown) => {
          this.logger.warn(
            "reasoning cache write failed",
            err instanceof Error ? err.message : String(err)
          );
        });

      return { reasoning, fromCache: false, fromFallback: false };
    } catch (error: unknown) {
      this.logger.warn(
        "generateReasoning AI failed → fallback",
        error instanceof Error ? error.message : String(error)
      );
      return {
        reasoning: this.fallbackReasoning(args.matchedCriteria),
        fromCache: false,
        fromFallback: true
      };
    }
  }

  // ── private ──────────────────────────────────────────

  private hashProfile(attrs: Record<string, unknown>): string {
    // Sort keys + JSON serialize cho determinism.
    const keys = Object.keys(attrs).sort();
    const normalized: Record<string, unknown> = {};
    for (const k of keys) {
      const v = attrs[k];
      if (v === undefined || v === null || v === "") continue;
      normalized[k] = v;
    }
    return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 32);
  }

  private fallbackReasoning(matched: MatchedCriterion[]): string {
    const topMatches = matched
      .filter((c) => c.matched)
      .slice(0, 2)
      .map((c) => c.label.replace(/[?]/g, "").trim());
    if (topMatches.length === 0) {
      return "Đề xuất từ danh mục đã admin duyệt.";
    }
    return `Hợp với nhu cầu của bạn: ${topMatches.join(" + ")}.`;
  }

  private async getPromptOrDefault(name: string, fallback: string): Promise<string> {
    try {
      const tpl = await this.prisma.promptTemplate.findFirst({
        where: { name, isActive: true },
        orderBy: { version: "desc" }
      });
      return tpl?.content ?? fallback;
    } catch (error: unknown) {
      this.logger.warn(
        `PromptTemplate ${name} lookup failed, using fallback`,
        error instanceof Error ? error.message : String(error)
      );
      return fallback;
    }
  }
}

const DEFAULT_PARSE_PROMPT = `Bạn là AI giúp parse mô tả tự nhiên của user về nhu cầu mua sản phẩm thành dạng structured.

Quiz schema (mỗi attribute có id, type, optional choices):
{schemaDescription}

User message (tiếng Việt):
"""
{userMessage}
"""

Trả về JSON đúng format sau (KHÔNG markdown, KHÔNG giải thích):
{
  "attributes": {
    "<attribute_id>": <value khớp type/choice>,
    ...
  },
  "confidence": {
    "<attribute_id>": <0.0-1.0>,
    ...
  }
}

Quy tắc:
- Chỉ điền attribute mà user mention rõ. Không suy đoán quá nhiều.
- Với single/picture: value phải khớp 1 trong choices.
- Với number/range: parse số từ tiếng Việt ("tám triệu" → 8000000).
- Với multi: trả array.
- Nếu user không nói rõ → bỏ qua attribute đó (không điền null/empty).
- Confidence: 1.0 = user nói trực tiếp, 0.5 = suy luận, 0.3 = đoán.`;

const DEFAULT_REASONING_PROMPT = `Bạn là AI tư vấn mua đồ điện máy cho người Việt. Viết 1 câu duy nhất (≤25 từ) giải thích vì sao sản phẩm này hợp với nhu cầu của user. Có thể thêm 1 câu "điểm trừ" ngắn inline với prefix "💡 " nếu cần (vd "💡 Cần thay lõi mỗi 6 tháng ~500k").

User profile:
{userProfile}

Tiêu chí khớp:
{matched}

Tiêu chí KHÔNG khớp:
{unmatched}

Sản phẩm:
{productSummary}

Output JSON (KHÔNG markdown):
{
  "reasoning": "<1 câu lý do + optional điểm trừ inline>"
}

Quy tắc cứng:
- Phải reference ≥1 thông tin cụ thể từ user profile (vd "nhà 4 người", "ngân sách 8tr").
- KHÔNG dùng từ marketing rỗng ("siêu phẩm", "tốt nhất", "đỉnh cao", "đáng đồng tiền").
- Mobile-friendly: đọc trong 3 giây, không dài dòng.
- Tiếng Việt tự nhiên, ngôi "bạn".`;
