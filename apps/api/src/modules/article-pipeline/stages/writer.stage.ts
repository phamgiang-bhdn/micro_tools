import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../../prisma/prisma.service";
import { AiService } from "../../../services/ai.service";
import {
  ArticleBrief,
  HookPattern,
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext,
  VoiceProfile
} from "../pipeline.types";
import { wordCount } from "../utils/text-stats";

/**
 * AI output cho Writer phải là object `{ blocks: [...] }` (không phải array trực tiếp).
 * Lý do: OpenAI-compatible response_format=json_object chỉ chấp nhận top-level object.
 * Array bao ngoài → provider reject.
 */
const writerBlocksSchema = z.object({
  blocks: z
    .array(
      z
        .object({
          type: z.string()
        })
        .passthrough()
    )
    .min(1)
    .max(12)
});

@Injectable()
export class WriterStage implements PipelineStage {
  readonly name = PipelineStageName.WRITER;
  readonly agent = "writer@v2";
  private readonly logger = new Logger(WriterStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      include: { author: true, niche: true }
    });
    if (!article) throw new Error("Article not found");

    const sections = await this.prisma.articleSection.findMany({
      where: { articleId: ctx.articleId },
      orderBy: { order: "asc" }
    });

    const brief = (article.briefJson ?? null) as ArticleBrief | null;
    const voice = (article.author?.voiceProfile ?? null) as VoiceProfile | null;

    let totalWords = 0;
    const failedSections: string[] = [];
    const concurrency = 2;

    // Section pending = chỉ viết lại DRAFTING + FAILED.
    // WRITTEN (đã viết, chờ duyệt) + APPROVED (admin duyệt) → giữ nguyên, không tốn AI call.
    // Admin muốn viết lại WRITTEN section → bấm "Đặt lại để viết lại" (DRAFTING) ở tab Các phần.
    const pending = sections.filter((s) => {
      if (s.status === "WRITTEN" || s.status === "APPROVED") {
        totalWords += s.wordCount;
        return false;
      }
      return true;
    });

    let doneCount = 0;
    // Section write KHÔNG catch nội bộ — fail thì throw để outer loop break.
    // Theo policy "AI fail là dừng, không retry" — 1 section fail → stop writer, mark article FAILED,
    // admin tự bấm "Chạy lại bước 6" khi muốn thử lại.
    const writeSection = async (section: typeof pending[number]) => {
      const evidence = section.evidenceRefs.length
        ? await this.prisma.articleEvidence.findMany({
            where: { id: { in: section.evidenceRefs } }
          })
        : [];
      const isFirstSection = section.order === 0;
      try {
        const blocks = await this.writeSectionWithAi({
          section,
          brief,
          voice,
          evidence,
          articleTitle: article.title,
          isFirstSection,
          hookPattern: isFirstSection ? brief?.hookPattern ?? null : null
        });
        const wc = wordCount(blocksToPlainText(blocks));
        totalWords += wc;
        await this.prisma.articleSection.update({
          where: { id: section.id },
          data: {
            blocks: blocks as unknown as Prisma.InputJsonValue,
            wordCount: wc,
            status: "WRITTEN"
          }
        });
        doneCount += 1;
        await ctx.reportProgress?.(
          `Viết ${doneCount}/${pending.length}: ${section.heading.slice(0, 60)}`,
          Math.round((doneCount / Math.max(1, pending.length)) * 95)
        );
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.warn(`Section "${section.heading}" write failed: ${msg}`);
        failedSections.push(section.heading);
        await this.prisma.articleSection.update({
          where: { id: section.id },
          data: { status: "FAILED" }
        });
        throw err; // bubble lên outer → break batch loop
      }
    };

    // Chia thành batch concurrency. Section fail → Promise.all reject → break.
    for (let i = 0; i < pending.length; i += concurrency) {
      const batch = pending.slice(i, i + concurrency);
      try {
        await Promise.all(batch.map(writeSection));
      } catch (err) {
        // Section đã được mark FAILED ở writeSection. Throw để runner mark article FAILED.
        throw new Error(
          `Writer dừng vì section fail: ${failedSections.join(", ")} — ${(err as Error).message}`
        );
      }
    }

    await this.prisma.article.update({
      where: { id: ctx.articleId },
      data: {
        wordCount: totalWords,
        aiRevisionCount: { increment: 1 }
      }
    });

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: {
        sectionsWritten: sections.length - failedSections.length,
        sectionsFailed: failedSections.length,
        totalWords
      }
    };
  }

  private async writeSectionWithAi(args: {
    section: { heading: string; summary: string; intent: string | null; estimatedWords: number; blockTypeHints: string[] };
    brief: ArticleBrief | null;
    voice: VoiceProfile | null;
    evidence: Array<{ id: string; type: string; title: string | null; sourceUrl: string; sourceDomain: string; payload: Prisma.JsonValue }>;
    articleTitle: string;
    isFirstSection: boolean;
    hookPattern: HookPattern | null;
  }): Promise<unknown[]> {
    const { section, brief, voice, evidence, articleTitle, isFirstSection, hookPattern } = args;

    const voiceLines = voice
      ? [
          `[voice.tone]: ${voice.tone}`,
          `[voice.vocab]: ${voice.vocabRange}`,
          `[voice.sentenceLength]: ${voice.sentenceLength}`,
          `[voice.englishLoanwords]: ${voice.englishLoanwords}`,
          voice.quirks.length ? `[voice.quirks]: ${voice.quirks.join("; ")}` : null
        ]
          .filter(Boolean)
          .join("\n")
      : "[voice]: neutral, conversational";

    const evidenceLines = evidence
      .map(
        (e) =>
          `- [${e.id}] ${e.type}: ${e.title ?? ""} — ${e.sourceUrl} — payload: ${JSON.stringify(e.payload).slice(0, 200)}`
      )
      .join("\n") || "(không có evidence; viết dựa trên kiến thức tổng quát + summary section)";

    const hookLine =
      isFirstSection && hookPattern ? `[hookPattern]: dùng kiểu "${hookPattern}" để mở bài.` : "";

    const minWords = Math.floor(section.estimatedWords * 0.8);

    const prompt = `Bạn là writer viết bài "${articleTitle}". Bây giờ viết MỘT section cụ thể.

[section.heading]: ${section.heading}
[section.summary]: ${section.summary}
[section.intent]: ${section.intent ?? "n/a"}
[section.estimatedWords]: ${section.estimatedWords} (min ${minWords})
[section.blockTypeHints]: ${section.blockTypeHints.join(", ") || "prose"}
${hookLine}

[thesis]: ${brief?.thesis ?? ""}
[persona]: ${brief ? JSON.stringify(brief.persona) : ""}

${voiceLines}

[evidence] (chỉ dùng claim từ evidence này; nếu cần cite → tạo block type "citation" với sourceUrl):
${evidenceLines}

Quy tắc:
1. Viết blocks JSON cho section này (KHÔNG viết cả bài).
2. Tổng từ trong section ≥ ${minWords}.
3. Dùng block types đa dạng từ [blockTypeHints]. KHÔNG dùng toàn "prose".
4. Mỗi claim dữ kiện (số liệu, ngày tháng, tên model) phải có nguồn — hoặc trong text rồi thêm block { "type":"citation", "claim":"...", "sourceUrl":"...", "sourceTitle":"...", "fetchedAt":"YYYY-MM-DD" }, hoặc nếu evidence là review thì dùng block { "type":"review_quote", "productId":"...", "body":"...", "sourceUrl":"...", "verifiedBuyer":true|false, "author":"...", "rating": number }.
5. CẤM dùng cụm cliché: "trong thời đại công nghệ 4.0", "không thể phủ nhận", "tóm lại", "đáng đồng tiền bát gạo", "siêu phẩm", "lựa chọn hoàn hảo", "tối ưu hoá trải nghiệm", "nâng tầm trải nghiệm".
6. Giọng văn theo [voice]. Câu mở section (nếu không phải hook section) KHÔNG bắt đầu bằng "Trong phần này…" / "Tiếp theo…".
7. Trả về JSON object có schema CHÍNH XÁC:
{
  "blocks": [
    { "type": "prose", "markdown": "..." },
    { "type": "...", ... }
  ]
}
Field "blocks" là array các block. KHÔNG trả array trực tiếp ngoài cùng.`;

    const raw = await this.ai.generateJson<unknown>(prompt);
    const parsed = writerBlocksSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Writer output invalid: ${parsed.error.message}`);
    }
    return parsed.data.blocks;
  }
}

function blocksToPlainText(blocks: unknown[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const obj = b as Record<string, unknown>;
    if (typeof obj.markdown === "string") parts.push(obj.markdown);
    if (typeof obj.body === "string") parts.push(obj.body);
    if (typeof obj.text === "string") parts.push(obj.text);
    if (typeof obj.summary === "string") parts.push(obj.summary);
    if (Array.isArray(obj.items)) {
      for (const it of obj.items) {
        if (it && typeof it === "object") {
          const iObj = it as Record<string, unknown>;
          if (typeof iObj.body === "string") parts.push(iObj.body);
          if (typeof iObj.a === "string") parts.push(iObj.a);
          if (typeof iObj.q === "string") parts.push(iObj.q);
        }
      }
    }
  }
  return parts.join("\n\n");
}
