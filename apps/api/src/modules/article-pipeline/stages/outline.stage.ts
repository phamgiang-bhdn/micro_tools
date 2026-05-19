import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../../prisma/prisma.service";
import { AiService } from "../../../services/ai.service";
import {
  ArticleBrief,
  ArticleOutline,
  IntentKind,
  OutlineSectionSpec,
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext
} from "../pipeline.types";

function slugifyAnchor(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "section";
}

const outlineAiSchema = z.object({
  sections: z
    .array(
      z.object({
        anchorSlug: z.preprocess(
          (v) => (typeof v === "string" ? slugifyAnchor(v) : v),
          z.string().min(2).max(120).regex(/^[a-z0-9-]+$/)
        ),
        heading: z.string().min(3).max(250),
        summary: z.string().min(10).max(600),
        intent: z.string().max(100),
        evidenceRefs: z.array(z.string()).max(20).default([]),
        blockTypeHints: z.array(z.string()).max(12).default([]),
        isRequired: z.boolean().default(true),
        estimatedWords: z.number().int().min(50).max(3000)
      })
    )
    .min(3)
    .max(12)
});

@Injectable()
export class OutlineStage implements PipelineStage {
  readonly name = PipelineStageName.OUTLINE;
  readonly agent = "outline@v2";
  private readonly logger = new Logger(OutlineStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      select: { briefJson: true, type: true, nicheId: true, title: true, topic: true }
    });
    if (!article) throw new Error("Article not found");

    await ctx.reportProgress?.("Lập dàn ý từ evidence + thesis…", 20);

    const brief = (article.briefJson ?? null) as ArticleBrief | null;
    const intent: IntentKind =
      brief?.intent ?? (article.type === "BUYING_GUIDE" ? "transactional" : "commercial-investigation");

    // Lấy evidence để AI biết có data gì → assign vào section.
    // Cap 20 (trước 50) để rút prompt → AI trả nhanh hơn. 20 đã đủ phân bổ 4-8 section.
    const evidence = await this.prisma.articleEvidence.findMany({
      where: { articleId: ctx.articleId },
      select: { id: true, type: true, title: true, sourceDomain: true, payload: true },
      orderBy: { fetchedAt: "desc" },
      take: 20
    });

    const outline = await this.generateOutlineWithAi(article.topic ?? article.title, brief, intent, evidence);

    await ctx.reportProgress?.(`Tạo ${outline.sections.length} phần…`, 80);

    await this.prisma.$transaction([
      this.prisma.articleSection.deleteMany({ where: { articleId: ctx.articleId } }),
      this.prisma.articleSection.createMany({
        data: outline.sections.map((s, i) => ({
          articleId: ctx.articleId,
          anchorSlug: s.anchorSlug,
          heading: s.heading,
          summary: s.summary,
          intent: s.intent,
          order: i,
          blocks: [] as Prisma.InputJsonValue,
          blockTypeHints: s.blockTypeHints,
          evidenceRefs: s.evidenceRefs.filter((r) => evidence.some((e) => e.id === r)),
          estimatedWords: s.estimatedWords,
          isRequired: s.isRequired,
          status: "DRAFTING"
        }))
      }),
      this.prisma.article.update({
        where: { id: ctx.articleId },
        data: { outlineJson: outline as unknown as Prisma.InputJsonValue }
      })
    ]);

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: {
        sectionCount: outline.sections.length,
        totalEstimatedWords: outline.totalEstimatedWords,
        evidenceLinked: outline.sections.reduce((sum, s) => sum + s.evidenceRefs.length, 0)
      }
    };
  }

  private async generateOutlineWithAi(
    topic: string,
    brief: ArticleBrief | null,
    intent: IntentKind,
    evidence: Array<{ id: string; type: string; title: string | null; sourceDomain: string }>
  ): Promise<ArticleOutline> {
    const evidenceList = evidence
      .map((e) => `- [${e.id}] ${e.type}: ${(e.title ?? "").slice(0, 80)} — ${e.sourceDomain}`)
      .join("\n") || "(no evidence)";

    const targetDepthBand = brief?.targetDepth === "deep-dive" ? "2500-3500" : brief?.targetDepth === "shallow" ? "800-1200" : "1500-2200";

    const prompt = `Bạn là biên tập trưởng. Lập outline cho bài về:

[topic]: ${topic}
[thesis]: ${brief?.thesis ?? "(chưa có)"}
[intent]: ${intent}
[persona]: ${brief ? JSON.stringify(brief.persona) : "(không cụ thể)"}
[targetKeywords]: ${brief?.targetKeywords?.join(", ") ?? ""}
[targetDepthBand]: ${targetDepthBand} từ tổng

[evidence] (có thể gán vào section qua "evidenceRefs"; ID là string trong [...]):
${evidenceList}

Quy tắc:
1. 4-8 sections, mỗi section có "anchorSlug" (kebab-case, unique), "heading", "summary" (1-2 câu — sẽ hiển thị trên TOC khi user hover/jump), "intent", "estimatedWords", "evidenceRefs" (chỉ dùng ID có trong [evidence]), "blockTypeHints" (gợi ý block types: prose, criteria_grid, product_spotlight, comparison, callout, pros_cons, faq, verdict, review_quote, image, image_gallery, price_history, citation, section_tldr).
2. Order tự do — KHÔNG bắt buộc FAQ cuối. Section "Hook" hoặc tương đương luôn đầu tiên (intent="hook"). Section "Verdict/Kết luận" cuối cùng cho transactional/comparison.
3. Mỗi section trừ "hook" và "verdict" PHẢI có ≥1 evidenceRef (nếu evidence list rỗng → tạm để [] và Sprint sau bổ sung).
4. Tổng estimatedWords = ${targetDepthBand} (cộng các section vừa khít band).
5. Section heading hấp dẫn, KHÔNG generic kiểu "Giới thiệu" / "Kết luận" — phải bám sát thesis.
6. blockTypeHints đa dạng — KHÔNG section nào chỉ "prose". Xen "criteria_grid", "callout", "review_quote", "image" để chống wall-of-text.

Trả JSON thuần, schema: { "sections": [...] }`;

    const raw = await this.ai.generateJson<unknown>(prompt);
    const parsed = outlineAiSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Outline AI output invalid: ${parsed.error.message}`);
    }

    // De-dupe anchorSlug
    const seenSlugs = new Set<string>();
    const sections: OutlineSectionSpec[] = [];
    for (const s of parsed.data.sections) {
      let slug = s.anchorSlug;
      let suffix = 1;
      while (seenSlugs.has(slug)) {
        suffix += 1;
        slug = `${s.anchorSlug}-${suffix}`;
      }
      seenSlugs.add(slug);
      sections.push({ ...s, anchorSlug: slug });
    }

    const totalEstimatedWords = sections.reduce((sum, s) => sum + s.estimatedWords, 0);
    return { sections, totalEstimatedWords };
  }
}
