import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ArticleBrief,
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext
} from "../pipeline.types";
import {
  DEFAULT_PHRASE_BLACKLIST,
  findBlacklistedPhrases,
  ngramOverlapRatio,
  readability,
  wordCount
} from "../utils/text-stats";

interface CriticIssue {
  sectionId?: string;
  severity: "block" | "warn";
  code: string;
  reason: string;
  suggestion?: string;
}

@Injectable()
export class CriticStage implements PipelineStage {
  readonly name = PipelineStageName.CRITIC;
  readonly agent = "critic@v2";
  private readonly logger = new Logger(CriticStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      select: { briefJson: true, nicheId: true, aiRevisionCount: true, wordCount: true }
    });
    if (!article) throw new Error("Article not found");

    await ctx.reportProgress?.("Đang chấm bài (độ dài / cliché / trùng lặp)…", 30);

    const sections = await this.prisma.articleSection.findMany({
      where: { articleId: ctx.articleId },
      orderBy: { order: "asc" }
    });
    const brief = (article.briefJson ?? null) as ArticleBrief | null;
    const targetDepth = brief?.targetDepth ?? "medium";
    const [minWords, maxWords] =
      targetDepth === "deep-dive" ? [2500, 3500] : targetDepth === "shallow" ? [800, 1200] : [1500, 2200];

    const issues: CriticIssue[] = [];
    const allSectionText = sections.map((s) => sectionPlainText(s.blocks)).join("\n\n");

    // 1. Total word count
    const totalWords = wordCount(allSectionText);
    if (totalWords < minWords) {
      issues.push({
        severity: "block",
        code: "TOTAL_WORDS_BELOW",
        reason: `Tổng ${totalWords} từ, dưới ngưỡng ${minWords} (targetDepth=${targetDepth})`
      });
    } else if (totalWords > maxWords * 1.4) {
      issues.push({
        severity: "warn",
        code: "TOTAL_WORDS_ABOVE",
        reason: `Tổng ${totalWords} từ, vượt band ${maxWords} đáng kể`
      });
    }

    // 2. Section thinness
    for (const s of sections) {
      const sWords = wordCount(sectionPlainText(s.blocks));
      const min = Math.floor(s.estimatedWords * 0.6);
      if (sWords < min && s.isRequired) {
        issues.push({
          sectionId: s.id,
          severity: "block",
          code: "SECTION_THIN",
          reason: `Section "${s.heading}" có ${sWords} từ, dưới min ${min}`
        });
      }
    }

    // 3. Wall-of-text per section
    for (const s of sections) {
      const blocks = Array.isArray(s.blocks) ? (s.blocks as unknown[]) : [];
      const types = new Set<string>();
      for (const b of blocks) {
        if (b && typeof b === "object" && typeof (b as Record<string, unknown>).type === "string") {
          types.add((b as Record<string, string>).type);
        }
      }
      const visual = ["image", "image_gallery", "criteria_grid", "callout", "product_spotlight", "comparison", "review_quote", "price_history"].some((t) => types.has(t));
      if (!visual && blocks.length > 0 && s.estimatedWords >= 200) {
        issues.push({
          sectionId: s.id,
          severity: "warn",
          code: "WALL_OF_TEXT",
          reason: `Section "${s.heading}" toàn prose, thiếu visual block`
        });
      }
    }

    // 4. Phrase blacklist
    const blacklist = await this.loadBlacklist();
    const blackHits = findBlacklistedPhrases(allSectionText, blacklist);
    if (blackHits.length > 0) {
      issues.push({
        severity: "block",
        code: "PHRASE_BLACKLIST",
        reason: `Dùng phrase cliché: ${blackHits.slice(0, 5).join(", ")}`
      });
    }

    // 5. N-gram overlap với corpus
    if (article.nicheId) {
      const corpus = await this.loadCorpus(article.nicheId, ctx.articleId);
      const ratio = ngramOverlapRatio(allSectionText, corpus, 4);
      const threshold = 0.15;
      if (ratio > threshold) {
        issues.push({
          severity: "block",
          code: "NGRAM_OVERLAP_HIGH",
          reason: `${(ratio * 100).toFixed(1)}% n-gram (4-gram) trùng bài đã PUBLISHED cùng niche (threshold ${(threshold * 100).toFixed(0)}%)`
        });
      }
    }

    // 6. Evidence coverage (any section claim không cite) — soft check
    const hasEvidence = sections.some((s) => s.evidenceRefs.length > 0);
    if (!hasEvidence) {
      issues.push({
        severity: "warn",
        code: "NO_EVIDENCE",
        reason: "Bài không có evidence được link — content sẽ bị Google đánh thin"
      });
    }

    // Update article stats
    const readScore = readability(allSectionText);
    await this.prisma.article.update({
      where: { id: ctx.articleId },
      data: { wordCount: totalWords, readabilityScore: Math.round(readScore) }
    });

    const blockIssues = issues.filter((i) => i.severity === "block");
    const maxLoops = 2;

    // Lưu issues vào ArticleGenerationRun output via outputSummary (visible trong admin UI Sprint 3)
    if (blockIssues.length > 0 && article.aiRevisionCount < maxLoops) {
      // Loop back to writer
      this.logger.warn(`Critic flag ${blockIssues.length} block issues, looping back to writer (revision ${article.aiRevisionCount + 1}/${maxLoops})`);

      // Mark flagged sections back to DRAFTING
      const sectionsToRevise = blockIssues
        .filter((i) => i.sectionId)
        .map((i) => i.sectionId!) as string[];
      if (sectionsToRevise.length > 0) {
        await this.prisma.articleSection.updateMany({
          where: { id: { in: sectionsToRevise } },
          data: { status: "DRAFTING" }
        });
      }

      return {
        nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
        outputSummary: { issues, totalWords, readabilityScore: Math.round(readScore), loopBack: true },
        loopBackTo: PipelineStageName.WRITER
      };
    }

    if (blockIssues.length > 0) {
      // Đã exhaust revise quota → NEEDS_REVISION (human takeover)
      this.logger.warn(`Critic still flags ${blockIssues.length} after ${article.aiRevisionCount} loops → NEEDS_REVISION`);
      return {
        nextStatus: ArticleStatus.NEEDS_REVISION,
        outputSummary: { issues, totalWords, readabilityScore: Math.round(readScore), exhausted: true }
      };
    }

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: { issues, totalWords, readabilityScore: Math.round(readScore) }
    };
  }

  private async loadBlacklist(): Promise<string[]> {
    const row = await this.prisma.promptTemplate.findFirst({
      where: { name: "phrase-blacklist", isActive: true }
    });
    if (!row) return DEFAULT_PHRASE_BLACKLIST;
    return row.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  }

  private async loadCorpus(nicheId: string, excludeArticleId: string): Promise<string[]> {
    const rows = await this.prisma.article.findMany({
      where: { nicheId, status: ArticleStatus.PUBLISHED, id: { not: excludeArticleId } },
      select: { body: true },
      take: 50,
      orderBy: { publishedAt: "desc" }
    });
    return rows.map((r) => r.body).filter(Boolean);
  }
}

function sectionPlainText(blocks: Prisma.JsonValue): string {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const obj = b as Record<string, unknown>;
    for (const k of ["markdown", "body", "text", "summary", "claim"]) {
      const v = obj[k];
      if (typeof v === "string") parts.push(v);
    }
    if (Array.isArray(obj.items)) {
      for (const it of obj.items as unknown[]) {
        if (it && typeof it === "object") {
          const iObj = it as Record<string, unknown>;
          for (const k of ["body", "a", "q", "title"]) {
            const v = iObj[k];
            if (typeof v === "string") parts.push(v);
          }
        }
      }
    }
  }
  return parts.join("\n");
}
