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
        // Section ngắn = scan-friendly. 60-300 từ thay vì 50-3000.
        // User affiliate đọc lướt, không đọc luận văn.
        estimatedWords: z.number().int().min(60).max(300)
      })
    )
    // 6-12 section thay vì 3-12: chia nhỏ mối quan tâm để user scan nhanh.
    .min(6)
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

**Triết lý affiliate Việt Nam**: User đọc xong phải **MUỐN mua**. Heading = câu kết luận tích cực dẫn dắt cảm xúc, body chứng minh ngắn gọn. User scroll thấy chuỗi heading liên tiếp toàn ưu điểm cụ thể có dẫn chứng → tin tưởng → bấm CTA. Mỗi section ngắn (1 điểm cộng cụ thể, ≤300 từ). Pattern hiệu quả: heading-as-positive-conclusion → 1-2 đoạn ngắn → bullet/table → ảnh sản phẩm thật → product slot hoặc CTA.

**Phân bổ cảm xúc tổng bài**:
- ~70% section nói về **ưu điểm/giá trị nhận được** (mỗi section 1 lợi ích cụ thể có số liệu).
- ~20% section nói về **nhược/tradeoff** — luôn kèm work-around hoặc context "không phải vấn đề với phần đông user".
- ~10% verdict cuối nghiêng **"đáng mua nếu…"** thay vì "có nên mua không?".

Quy tắc:
1. **6-12 section** (nhiều, ngắn, mỗi section 1 mối quan tâm cụ thể), mỗi section có "anchorSlug" (kebab-case, unique), "heading", "summary" (1-2 câu — TOC hover/jump, KHÔNG hiển thị trong bài), "intent", "estimatedWords" (60-300 từ), "evidenceRefs" (chỉ dùng ID có trong [evidence]), "blockTypeHints", "isRequired".

2. Cấu trúc khuyến nghị (xem 1 ví dụ điện thoại — adapt cho ngách của bạn):
   - Section 1 (hook, ~80 từ): mở bài, set context, intent="hook"
   - Section 2 (~150 từ): Mở hộp / Phụ kiện / Cấu hình tổng quan
   - Section 3 (~200 từ): Thiết kế (1 mối quan tâm)
   - Section 4 (~200 từ): Màn hình
   - Section 5 (~200 từ): Camera
   - Section 6 (~200 từ): Hiệu năng
   - Section 7 (~150 từ): Pin & sạc
   - Section 8 (~150 từ): Phần mềm / Hệ điều hành
   - Section 9 (~120 từ): Kết luận + Ai nên mua + Có nên đợi không (intent="verdict")
   Hoặc với buying guide / so sánh: 1 section / sản phẩm + 1 section "Cách chọn" + 1 section verdict.

3. Mỗi section trừ "hook" và "verdict" PHẢI có ≥1 evidenceRef (evidence list rỗng → tạm []).

4. Tổng estimatedWords ≈ ${targetDepthBand} từ. Chia đều với phân bổ trên.

5. **Heading style = KẾT LUẬN TÍCH CỰC có dẫn chứng**:
   - DÙNG dạng "ưu điểm cụ thể + số liệu/use case": "Pin 5500mAh dùng 2 ngày không sạc", "Camera 200MP chụp đêm cực sáng", "Hiệu năng dư sức cân Genshin max setting", "Sạc 90W đầy pin trong 30 phút", "Màn hình 144Hz mượt cho game thủ", "Thiết kế nhẹ 188g cầm thoải mái cả ngày".
   - Với section nhược điểm (1-2 section trong toàn bài) → framework thành **tradeoff có context**, KHÔNG nguyên dạng tiêu cực: "Camera tele yếu hơn flagship — nhưng selfie + main cam vẫn xuất sắc", "Không sạc không dây — đổi lại sạc nhanh 90W bù lại", "Loa mono đủ nghe, audiophile nên sắm tai nghe rời".
   - KHÔNG dùng question form: TRÁNH "Hiệu năng game thực tế ra sao?", "Camera có đẹp không?".
   - Ngoại lệ verdict cuối: "Đáng mua nếu bạn là…", "[Sản phẩm] phù hợp ai?", "Kết luận: deal tầm X triệu này có gì đáng giá" — KHÔNG dùng "Có nên mua không?" (lửng lơ → giảm conversion).
   - CẤM tiêu cực: "Đốt tiền", "Con dao hai lưỡi", "Cái giá phải trả", "Cỗ máy hủy diệt ví", "Cảnh báo", "Sai lầm tỷ đồng", "Đánh đổi tàn khốc", "Có nên tránh".
   - CẤM nịnh rỗng: "Siêu phẩm", "Đỉnh cao", "Không đối thủ", "Vô địch", "Thần thánh", "Bá đạo" (không có số liệu kèm theo = nịnh).
   - CẤM generic: "Giới thiệu", "Tổng quan", "Đôi nét", "Lời kết", "Tóm lại".

6. **blockTypeHints**: mỗi section BẮT BUỘC có ≥2 type non-prose. Pattern khuyến nghị:
   - Section mở hộp/phụ kiện: ["prose", "image"] + LIST trong prose (markdown bullet)
   - Section thông số: ["prose", "criteria_grid", "image"]
   - Section thiết kế/màn hình/camera: ["prose", "image", "callout"] (callout cho 1 điểm nổi bật)
   - Section hiệu năng: ["prose", "criteria_grid", "callout", "image"]
   - Section pin: ["prose", "criteria_grid", "image"]
   - Section pros/cons: ["pros_cons"]
   - Section verdict: ["verdict", "product_spotlight"]

Trả JSON thuần, schema: { "sections": [...] }`;

    const raw = await this.ai.generateJson<unknown>(prompt, {
      label: "outline",
      timeoutMs: Number(process.env.AI_OUTLINE_TIMEOUT_MS ?? 60_000)
    });
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
