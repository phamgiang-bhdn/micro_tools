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

    // Few-shot exemplar: load tất cả `writer-exemplar-*` rồi random 1 cho mỗi article (KHÔNG đổi
    // giữa các section trong cùng article — giữ consistent voice). Inject vào prompt làm tham
    // chiếu văn phong/cấu trúc. Bài AI sinh ra sẽ tự nhiên hơn (Show > Tell).
    const exemplar = await this.pickRandomExemplar();

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
          hookPattern: isFirstSection ? brief?.hookPattern ?? null : null,
          exemplar
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

    // Post-process: AI hay quên emit image/review_quote block dù section có IMAGE/REVIEW evidence.
    // Tự inject để không vứt phí dữ liệu Image-stage + Review-scraper đã cào về.
    await ctx.reportProgress?.("Gắn ảnh + trích đánh giá vào bài…", 96);
    const mediaInjected = await this.injectMediaBlocks(ctx.articleId);

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
        totalWords,
        mediaBlocksInjected: mediaInjected
      }
    };
  }

  /**
   * Defensive: với mỗi section đã WRITTEN, kiểm tra evidenceRefs có IMAGE/REVIEW không.
   * Nếu có mà blocks chưa có image/review_quote tương ứng → tự inject (image sau prose đầu,
   * review_quote ở cuối). Tránh vứt phí output của Image-stage và Review-scraper-stage.
   */
  private async injectMediaBlocks(articleId: string): Promise<number> {
    const sections = await this.prisma.articleSection.findMany({
      where: { articleId, status: { in: ["WRITTEN", "APPROVED"] } },
      orderBy: { order: "asc" }
    });
    let injected = 0;

    for (const section of sections) {
      if (section.evidenceRefs.length === 0) continue;
      const evidence = await this.prisma.articleEvidence.findMany({
        where: { id: { in: section.evidenceRefs } }
      });
      const images = evidence.filter((e) => e.type === "IMAGE");
      const reviews = evidence.filter((e) => e.type === "REVIEW");
      if (images.length === 0 && reviews.length === 0) continue;

      const blocks = Array.isArray(section.blocks)
        ? ([...section.blocks] as Array<Record<string, unknown>>)
        : [];

      const hasImageBlock = blocks.some((b) => b?.type === "image");
      const hasReviewBlock = blocks.some((b) => b?.type === "review_quote");

      // Inject image: 1 ảnh đầu tiên sau prose block đầu (hoặc đầu nếu không có prose).
      if (!hasImageBlock && images[0]) {
        const payload = (images[0].payload ?? {}) as Record<string, unknown>;
        const imageBlock = {
          type: "image",
          src: payload.src ?? "",
          alt: images[0].title ?? "",
          caption: images[0].title ?? "",
          attribution: payload.attribution ?? "",
          attributionUrl: payload.attributionUrl ?? "",
          width: typeof payload.width === "number" ? payload.width : undefined,
          height: typeof payload.height === "number" ? payload.height : undefined
        };
        if (imageBlock.src) {
          const firstProseIdx = blocks.findIndex((b) => b?.type === "prose");
          const insertAt = firstProseIdx >= 0 ? firstProseIdx + 1 : 0;
          blocks.splice(insertAt, 0, imageBlock);
          injected += 1;
        }
      }

      // Inject review_quote: tới 2 review cuối section, ưu tiên rating cao + verifiedBuyer.
      if (!hasReviewBlock && reviews.length > 0) {
        const ranked = [...reviews].sort((a, b) => {
          const pa = (a.payload ?? {}) as Record<string, unknown>;
          const pb = (b.payload ?? {}) as Record<string, unknown>;
          const ra = typeof pa.rating === "number" ? pa.rating : 0;
          const rb = typeof pb.rating === "number" ? pb.rating : 0;
          return rb - ra;
        });
        for (const r of ranked.slice(0, 2)) {
          const payload = (r.payload ?? {}) as Record<string, unknown>;
          const body = typeof payload.body === "string" ? payload.body : typeof payload.snippet === "string" ? payload.snippet : "";
          if (!body) continue;
          blocks.push({
            type: "review_quote",
            body: body.slice(0, 600),
            author: typeof payload.author === "string" ? payload.author : undefined,
            rating: typeof payload.rating === "number" ? payload.rating : undefined,
            sourceUrl: r.sourceUrl,
            sourceName: r.sourceDomain,
            verifiedBuyer: payload.verifiedBuyer === true
          });
          injected += 1;
        }
      }

      if (blocks.length !== (Array.isArray(section.blocks) ? section.blocks.length : 0)) {
        await this.prisma.articleSection.update({
          where: { id: section.id },
          data: { blocks: blocks as unknown as Prisma.InputJsonValue }
        });
      }
    }
    return injected;
  }

  private async pickRandomExemplar(): Promise<string | null> {
    const rows = await this.prisma.promptTemplate.findMany({
      where: { name: { startsWith: "writer-exemplar-" }, isActive: true },
      select: { content: true }
    });
    if (rows.length === 0) return null;
    return rows[Math.floor(Math.random() * rows.length)].content;
  }

  private async writeSectionWithAi(args: {
    section: { heading: string; summary: string; intent: string | null; estimatedWords: number; blockTypeHints: string[] };
    brief: ArticleBrief | null;
    voice: VoiceProfile | null;
    evidence: Array<{ id: string; type: string; title: string | null; sourceUrl: string; sourceDomain: string; payload: Prisma.JsonValue }>;
    articleTitle: string;
    isFirstSection: boolean;
    hookPattern: HookPattern | null;
    exemplar: string | null;
  }): Promise<unknown[]> {
    const { section, brief, voice, evidence, articleTitle, isFirstSection, hookPattern, exemplar } = args;

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

    const imageEvidence = evidence.filter((e) => e.type === "IMAGE");
    const reviewEvidence = evidence.filter((e) => e.type === "REVIEW");
    const mediaRequirement: string[] = [];
    if (imageEvidence.length > 0) {
      const first = imageEvidence[0];
      const payload = (first.payload ?? {}) as Record<string, unknown>;
      mediaRequirement.push(
        `**BẮT BUỘC** chèn 1 block image (sau prose đầu tiên): { "type":"image", "src":"${payload.src ?? ""}", "alt":"${(first.title ?? "").replace(/"/g, "'")}", "caption":"${(first.title ?? "").replace(/"/g, "'")}", "attribution":"${payload.attribution ?? ""}", "attributionUrl":"${payload.attributionUrl ?? ""}" }`
      );
    }
    if (reviewEvidence.length > 0) {
      mediaRequirement.push(
        `**BẮT BUỘC** chèn 1-2 block review_quote (gần cuối section, trước verdict nếu có): { "type":"review_quote", "body":"<trích nguyên văn từ REVIEW evidence, không bịa>", "author":"<từ payload>", "rating":<từ payload>, "sourceUrl":"<sourceUrl evidence>", "sourceName":"<sourceDomain>", "verifiedBuyer":true|false }`
      );
    }
    const mediaBlock = mediaRequirement.length > 0 ? `\n[mediaRequirement]\n${mediaRequirement.join("\n")}\n` : "";

    const exemplarBlock = exemplar
      ? `\n[ví dụ section chất lượng — học theo cấu trúc + nhịp văn + cách dùng bullet/markdown, KHÔNG copy nội dung]:\n---\n${exemplar}\n---\n`
      : "";

    const hookLine =
      isFirstSection && hookPattern ? `[hookPattern]: dùng kiểu "${hookPattern}" để mở bài.` : "";

    const minWords = Math.floor(section.estimatedWords * 0.8);

    const prompt = `Bạn là writer của 1 blog affiliate Việt Nam, đang viết bài "${articleTitle}". Bây giờ viết MỘT section cụ thể.

**Triết lý affiliate**: user đọc xong phải **MUỐN bấm mua ngay**. Tone **tích cực nghiêng-mua**, đứng về phía user-sắp-móc-ví:
- Khi nêu **ưu điểm** (chiếm ~70% nội dung): dẫn số liệu/test/use-case CỤ THỂ ("pin 5500mAh xem TikTok 8h", "sạc 90W đầy 30 phút"), KHÔNG dùng tính từ rỗng ("rất tốt", "tuyệt vời", "đỉnh") cũng KHÔNG nịnh ("siêu phẩm", "không đối thủ").
- Khi nêu **nhược điểm** (chỉ ~20%): luôn framework thành "tradeoff đáng giá" + work-around/context. Đúng: "pin tụt nhanh khi chơi Genshin max — nhưng người dùng văn phòng dùng cả ngày vẫn dư". KHÔNG đứng riêng: "Pin yếu, không nên mua" (sai — đập sản phẩm).
- Khi nêu **verdict**: nghiêng "đáng mua nếu bạn là…" thay vì "tùy bạn" hay "có nên không". Mục tiêu là user đọc xong gật đầu "ok món này hợp với mình".
- CTA emotional khi phù hợp: "đang sale mạnh chỉ còn X", "tiết kiệm Y so với mẫu trước", "phù hợp nếu bạn đang…".

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
${mediaBlock}
${exemplarBlock}

Quy tắc:
1. Viết blocks JSON cho section này (KHÔNG viết cả bài). Section này CHỈ khoảng ${section.estimatedWords} từ, ngắn gọn scan-friendly.
2. Tổng từ trong section ≥ ${minWords} và ≤ ${Math.ceil(section.estimatedWords * 1.2)}.
3. **Pattern bắt buộc**: heading đã là kết luận → body ngắn chứng minh. Cấu trúc 1 section:
   - 1 prose block đầu (2-3 câu, set context section này — KHÔNG repeat heading)
   - Block visual: bullet list (markdown trong prose) HOẶC criteria_grid HOẶC callout HOẶC pros_cons HOẶC table → bất cứ thứ gì để liệt kê info SCAN-FRIENDLY thay vì viết prose dài
   - 1 image block (nếu evidence có IMAGE — mediaRequirement bên dưới)
   - (optional) 1 prose block cuối 1-2 câu chốt section
4. **Tránh wall of text**: mỗi prose block ≤ 3 câu (không ≥ 4). Nếu liệt kê ≥3 thứ → BẮT BUỘC dùng markdown bullet ("- item\\n- item\\n- item") hoặc criteria_grid block, KHÔNG viết "có A, có B, có C, và D" trong câu.
5. Mỗi claim dữ kiện (số liệu, ngày tháng, tên model) phải có nguồn — hoặc trong text rồi thêm block { "type":"citation", "claim":"...", "sourceUrl":"...", "sourceTitle":"...", "fetchedAt":"YYYY-MM-DD" }, hoặc nếu evidence là review thì dùng block { "type":"review_quote", "productId":"...", "body":"...", "sourceUrl":"...", "verifiedBuyer":true|false, "author":"...", "rating": number }.
6. CẤM dùng cụm cliché: "trong thời đại công nghệ 4.0", "không thể phủ nhận", "tóm lại", "đáng đồng tiền bát gạo", "siêu phẩm", "lựa chọn hoàn hảo", "tối ưu hoá trải nghiệm", "nâng tầm trải nghiệm".
7. **CẤM Vinglish (lai Anh-Việt khi có từ tiếng Việt tương đương)**. Viết tiếng Việt thuần. CỤ THỂ:
   - CẤM: "clock speed", "peak load", "multitasking", "foreground/background application", "voltage fluctuation", "thermal interface material", "stress test", "operating temperature", "dissipation", "degradation", "recovery", "benchmark" (động từ), "performance", "experience", "feature", "premium", "flagship", "trigger", "config", "setting" (động từ), "fix", "update", "review" (động từ), "test" (động từ), "process" (động từ), "stable", "smooth", "lag", "drop frame", "boost", "throttle" khi có từ Việt thay thế.
   - Phải dùng tiếng Việt: xung nhịp / tải đỉnh / đa nhiệm / ứng dụng nền & ứng dụng chính / biến động điện áp / lớp keo tản nhiệt / kiểm tra ngưỡng / nhiệt độ vận hành / tản nhiệt / suy giảm / phục hồi / chạy đo / hiệu năng / trải nghiệm / tính năng / cao cấp / đầu bảng / kích hoạt / cấu hình / cài đặt / sửa / cập nhật / đánh giá / kiểm tra / xử lý / ổn định / mượt / giật / rớt khung hình / đẩy / hạ xung.
   - CHO PHÉP giữ nguyên tiếng Anh: tên brand (Redmi, Xiaomi, Apple, Samsung, Google), tên chip/SoC (Snapdragon 8 Gen 3, Dimensity 9500s, A17 Pro), tên game/app (PUBG, Genshin, TikTok), đơn vị (mAh, GHz, W, fps), định danh kỹ thuật không có Việt hoá phổ biến (WiFi, Bluetooth, USB-C, OLED, AMOLED, RAM, ROM, GPS).
   - Câu nghi vấn: nếu phải dùng thuật ngữ Anh kỹ thuật → giải thích ngắn trong ngoặc lần đầu xuất hiện. VD "VRM (mạch điều khiển nguồn)".
8. Giọng văn theo [voice]. Câu mở section (nếu không phải hook section) KHÔNG bắt đầu bằng "Trong phần này…" / "Tiếp theo…".
9. **Product Slot — CỰC QUAN TRỌNG cho conversion**: Khi section nói về 1 sản phẩm/lựa chọn cụ thể (vd "Pin 5500mAh xuất sắc", "Robot Q8 Max+ cho nhà có chó", "Top 1: …"), BẮT BUỘC chèn 1 block product_slot ở vị trí đắc địa (thường sau prose mô tả ưu điểm, trước verdict mini). Pattern:
   { "type":"product_slot", "slotKey":"${section.heading.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-main", "hint":"<mô tả ngắn slot cần Product gì — vd 'điện thoại tầm 8tr pin trâu' hoặc 'robot hút bụi nhà có thú cưng dưới 15tr'>", "angle":"<1 câu spin tích cực 50-100 ký tự — VD 'Pin trâu nhất tầm giá, sạc nhanh 90W'>" }
   - **Bỏ qua** productId — admin sẽ gắn sau khi review. AI KHÔNG đoán productId.
   - **slotKey unique** trong scope section (kebab-case, ≤60 ký tự).
   - **hint** phải tả rõ slot này nên gắn Product loại nào (tầm giá, đặc điểm) — admin matcher dùng để filter Product DB.
   - **angle** = 1 câu tích cực dụ user click — sẽ hiển thị dưới tên sản phẩm trên card.
   - Section verdict cuối: BẮT BUỘC có ≥1 product_slot (CTA chốt đơn).
   - Section nhược điểm / so sánh chung: KHÔNG cần product_slot.

10. Trả về JSON object có schema CHÍNH XÁC:
{
  "blocks": [
    { "type": "prose", "markdown": "..." },
    { "type": "...", ... }
  ]
}
Field "blocks" là array các block. KHÔNG trả array trực tiếp ngoài cùng.`;

    const raw = await this.ai.generateJson<unknown>(prompt, {
      label: `writer:${section.heading.slice(0, 40)}`,
      timeoutMs: Number(process.env.AI_WRITER_TIMEOUT_MS ?? 90_000)
    });
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
