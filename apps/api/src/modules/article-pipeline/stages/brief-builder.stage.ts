import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../../prisma/prisma.service";
import { AiService } from "../../../services/ai.service";
import {
  ArticleBrief,
  HOOK_PATTERNS,
  HookPattern,
  LAYOUT_VARIANTS,
  LayoutVariant,
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext,
  VoiceProfile
} from "../pipeline.types";
import { cosineSimilarity, embedText } from "../utils/embedding";

/** Coerce free-text expertise label (vd "Beginner to Intermediate") về enum. */
const expertiseCoerce = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.toLowerCase();
  if (/\b(expert|pro|advanced|chuyên gia)\b/.test(s)) return "expert";
  if (/\b(intermediate|trung cấp|familiar)\b/.test(s)) return "intermediate";
  if (/\b(novice|beginner|newbie|mới|sơ cấp|basic)\b/.test(s)) return "novice";
  return v;
}, z.enum(["novice", "intermediate", "expert"]));

const briefAiSchema = z.object({
  thesis: z.string().min(20).max(500),
  targetKeywords: z.array(z.string()).min(1).max(15),
  competitorUrls: z.array(z.string().url()).max(10).optional().default([]),
  persona: z.object({
    name: z.string().max(120),
    painPoint: z.string().max(600),
    budget: z.string().max(120).nullable().optional(),
    expertise: expertiseCoerce
  }),
  targetDepth: z.enum(["shallow", "medium", "deep-dive"])
});

@Injectable()
export class BriefBuilderStage implements PipelineStage {
  readonly name = PipelineStageName.BRIEF_BUILDER;
  readonly agent = "brief-builder@v2";
  private readonly logger = new Logger(BriefBuilderStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      include: { niche: true }
    });
    if (!article) throw new Error("Article not found");

    const topic = article.topic ?? ctx.initialInput?.topic ?? article.title;
    const nicheName = article.niche?.name ?? "";
    const nicheId = article.nicheId;

    await ctx.reportProgress?.("Đang sinh luận điểm bài viết…", 15);

    // 1. AI sinh thesis + persona + keywords
    const aiBrief = await this.generateBriefWithAi(topic, nicheName, article.type);

    await ctx.reportProgress?.("Đang đối chiếu góc nhìn với bài đã có…", 45);

    // 2. Embedding uniqueness vs corpus
    let thesisEmbedding = await embedText(aiBrief.thesis);
    const threshold = 0.85;
    if (thesisEmbedding.length > 0 && nicheId) {
      const conflict = await this.findThesisConflict(nicheId, ctx.articleId, thesisEmbedding, threshold);
      if (conflict) {
        this.logger.warn(
          `Thesis trùng angle bài "${conflict.title}" (sim=${conflict.similarity.toFixed(3)}); retry với prompt né.`
        );
        await ctx.reportProgress?.(`Trùng góc với "${conflict.title.slice(0, 60)}", viết lại…`, 60);
        const retry = await this.generateBriefWithAi(topic, nicheName, article.type, conflict.thesis);
        aiBrief.thesis = retry.thesis;
        aiBrief.targetKeywords = retry.targetKeywords;
        thesisEmbedding = await embedText(aiBrief.thesis);
      }
    }

    await ctx.reportProgress?.("Đang chọn tác giả và bố cục…", 85);

    // 3. Author rotation + hook + layout
    const author = await this.pickAuthor(nicheId);
    const hookPattern = await this.pickHookPattern(nicheId);
    const layoutVariant = this.pickLayoutVariant(article.type);

    const brief: ArticleBrief = {
      thesis: aiBrief.thesis,
      intent:
        article.type === "BUYING_GUIDE"
          ? "transactional"
          : "commercial-investigation",
      targetKeywords: aiBrief.targetKeywords,
      competitorUrls: aiBrief.competitorUrls,
      persona: {
        name: aiBrief.persona.name,
        painPoint: aiBrief.persona.painPoint,
        budget: aiBrief.persona.budget ?? undefined,
        expertise: aiBrief.persona.expertise
      },
      layoutVariant,
      targetDepth: aiBrief.targetDepth,
      authorId: author?.id ?? "",
      hookPattern
    };

    await this.prisma.article.update({
      where: { id: ctx.articleId },
      data: {
        briefJson: brief as unknown as Prisma.InputJsonValue,
        authorId: author?.id ?? null,
        layoutVariant,
        thesisEmbedding,
        aiRevisionCount: 0
      }
    });

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: {
        thesis: brief.thesis,
        authorId: brief.authorId,
        authorName: author?.name,
        hookPattern,
        layoutVariant,
        targetDepth: brief.targetDepth,
        keywords: brief.targetKeywords.slice(0, 5)
      }
    };
  }

  private async generateBriefWithAi(
    topic: string,
    nicheName: string,
    type: string,
    avoidThesis?: string
  ) {
    const avoidLine = avoidThesis
      ? `\n[avoid] thesis sau ĐÃ CÓ bài tương tự, đề xuất góc nhìn KHÁC HOÀN TOÀN:\n${avoidThesis}`
      : "";
    const prompt = `Bạn là biên tập trưởng. Sinh "brief" cho bài ${type} về chủ đề sau:

[topic]: ${topic}
[niche]: ${nicheName || "(không cụ thể)"}
[market]: Việt Nam, ${new Date().getFullYear()}${avoidLine}

Yêu cầu:
1. "thesis": 1 câu khẳng định độc nhất (không chung chung). Góc nhìn cụ thể, có thể tranh luận.
2. "targetKeywords": 3-10 keyword SEO (tiếng Việt).
3. "persona": name (vd "Mẹ bỉm 30 tuổi"), painPoint (≤300 ký tự), budget (optional), expertise ("novice" | "intermediate" | "expert").
4. "targetDepth": "shallow" (800-1200) | "medium" (1500-2200) | "deep-dive" (2500+).

JSON thuần: { "thesis", "targetKeywords": [...], "persona": {...}, "targetDepth" }`;

    const raw = await this.ai.generateJson<unknown>(prompt);
    const parsed = briefAiSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(`Brief AI raw output: ${JSON.stringify(raw).slice(0, 1500)}`);
      throw new Error(`Brief AI output invalid: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  private async findThesisConflict(
    nicheId: string,
    excludeArticleId: string,
    candidateEmbedding: number[],
    threshold: number
  ): Promise<{ title: string; thesis: string; similarity: number } | null> {
    const recents = await this.prisma.article.findMany({
      where: {
        nicheId,
        id: { not: excludeArticleId },
        status: { notIn: [ArticleStatus.ARCHIVED, ArticleStatus.FAILED] },
        briefJson: { not: Prisma.JsonNull }
      },
      select: { id: true, title: true, briefJson: true, thesisEmbedding: true },
      take: 30,
      orderBy: { createdAt: "desc" }
    });

    for (const r of recents) {
      const thesis = extractThesis(r.briefJson);
      if (!thesis) continue;
      // Ưu tiên cached embedding; chỉ embed lại + lưu cache nếu thiếu (legacy article trước migration).
      let other = r.thesisEmbedding ?? [];
      if (other.length === 0) {
        other = await embedText(thesis);
        if (other.length > 0) {
          await this.prisma.article.update({
            where: { id: r.id },
            data: { thesisEmbedding: other }
          }).catch(() => undefined);
        }
      }
      const sim = cosineSimilarity(candidateEmbedding, other);
      if (sim > threshold) return { title: r.title, thesis, similarity: sim };
    }
    return null;
  }

  private async pickAuthor(nicheId: string | null) {
    let candidates = nicheId
      ? await this.prisma.author.findMany({
          where: { isActive: true, expertiseNiches: { has: nicheId } }
        })
      : [];
    if (candidates.length === 0) {
      candidates = await this.prisma.author.findMany({ where: { isActive: true } });
    }
    if (candidates.length === 0) return null;

    const recent = await this.prisma.article.findMany({
      where: nicheId ? { nicheId, authorId: { in: candidates.map((a) => a.id) } } : { authorId: { in: candidates.map((a) => a.id) } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { authorId: true }
    });
    const recentIds = new Set(recent.map((r) => r.authorId).filter((id): id is string => Boolean(id)));
    const fresh = candidates.filter((c) => !recentIds.has(c.id));
    return fresh[0] ?? candidates[Math.floor(Math.random() * candidates.length)];
  }

  private async pickHookPattern(nicheId: string | null): Promise<HookPattern> {
    if (!nicheId) return randomFrom(HOOK_PATTERNS);
    const recent = await this.prisma.article.findMany({
      where: { nicheId, briefJson: { not: Prisma.JsonNull } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { briefJson: true }
    });
    const used = new Set<string>(
      recent.map((r) => extractField(r.briefJson, "hookPattern")).filter((v): v is string => Boolean(v))
    );
    const fresh = HOOK_PATTERNS.filter((p) => !used.has(p));
    return fresh.length > 0 ? randomFrom(fresh) : randomFrom(HOOK_PATTERNS);
  }

  private pickLayoutVariant(type: string): LayoutVariant {
    if (type === "REVIEW") return "magazine";
    if (type === "BUYING_GUIDE") return "comparison-heavy";
    return LAYOUT_VARIANTS[0];
  }
}

function extractThesis(briefJson: Prisma.JsonValue | null): string | null {
  if (!briefJson || typeof briefJson !== "object" || Array.isArray(briefJson)) return null;
  const v = (briefJson as Record<string, unknown>).thesis;
  return typeof v === "string" ? v : null;
}

function extractField(briefJson: Prisma.JsonValue | null, key: string): string | null {
  if (!briefJson || typeof briefJson !== "object" || Array.isArray(briefJson)) return null;
  const v = (briefJson as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  tone: "conversational",
  vocabRange: "neutral",
  sentenceLength: "mixed",
  englishLoanwords: "moderate",
  openingPatterns: ["question", "scenario", "stat"],
  quirks: []
};
