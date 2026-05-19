import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, EvidenceType, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ArticleBrief,
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext
} from "../pipeline.types";
import { hostnameOf, sha256 } from "../utils/http";

/** Deny-list spam/farm. Cho phép mọi domain VN khác. */
const BLOCKED_DOMAINS = [
  "blogspot.com", "wordpress.com", "weebly.com", "wixsite.com",
  "5giay.vn", "rongbay.com", "muare.vn",
  "alibaba.com", "aliexpress.com",
  "facebook.com", "twitter.com", "tiktok.com", "instagram.com"
];


interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
}

@Injectable()
export class ResearchStage implements PipelineStage {
  readonly name = PipelineStageName.RESEARCH;
  readonly agent = "research@v2-tavily";
  private readonly logger = new Logger(ResearchStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      select: { briefJson: true, topic: true, title: true, type: true }
    });
    if (!article) throw new Error("Article not found");

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      this.logger.warn("TAVILY_API_KEY missing — research stage no-op (stub pass)");
      return {
        nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
        outputSummary: { skipped: "no TAVILY_API_KEY", evidenceCount: 0 }
      };
    }

    const brief = (article.briefJson ?? null) as ArticleBrief | null;
    const topic = article.topic ?? article.title;
    const queries = this.buildQueries(topic, brief);

    const allResults: TavilyResult[] = [];
    for (let i = 0; i < queries.length; i += 1) {
      await ctx.reportProgress?.(
        `Tra cứu Tavily (${i + 1}/${queries.length}): ${queries[i].slice(0, 60)}`,
        Math.round(((i + 1) / queries.length) * 70)
      );
      const results = await this.tavilySearch(queries[i], apiKey);
      allResults.push(...results);
    }

    const deduped = this.dedupeByUrl(allResults);
    const filtered = deduped.filter((r) => this.isAllowedDomain(r.url));
    const top = filtered.slice(0, 15);

    await ctx.reportProgress?.(`Lưu nguồn dẫn (${top.length})…`, 85);

    let inserted = 0;
    for (const r of top) {
      const domain = hostnameOf(r.url);
      const content = (r.content ?? "").slice(0, 4000);
      const payload = { snippet: content, title: r.title, score: r.score, publishedDate: r.published_date };
      const contentHash = sha256(r.url + content);

      // Skip if same evidence already in DB
      const exists = await this.prisma.articleEvidence.findFirst({
        where: { articleId: ctx.articleId, contentHash }
      });
      if (exists) continue;

      try {
        await this.prisma.articleEvidence.create({
          data: {
            articleId: ctx.articleId,
            type: this.classifyEvidence(domain, r.published_date),
            sourceUrl: r.url,
            sourceDomain: domain,
            title: r.title.slice(0, 200),
            payload: payload as Prisma.InputJsonValue,
            contentHash
          }
        });
        inserted += 1;
      } catch (err) {
        this.logger.warn(`Insert evidence failed: ${(err as Error).message}`);
      }
    }

    if (inserted === 0) {
      this.logger.warn(`Research found ${top.length} results but inserted 0 evidence`);
    }

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: { queries: queries.length, raw: allResults.length, filtered: filtered.length, inserted }
    };
  }

  private buildQueries(topic: string, brief: ArticleBrief | null): string[] {
    const year = new Date().getFullYear();
    const base = topic.trim();
    const queries = [
      `${base} review tốt nhất ${year} Việt Nam`,
      `${base} giá so sánh ${year}`,
      `${base} thông số mới nhất`,
      `${base} lỗi thường gặp người dùng`
    ];
    if (brief?.targetKeywords?.length) {
      queries.push(brief.targetKeywords.slice(0, 2).join(" ") + " " + year);
    }
    return queries.slice(0, 5);
  }

  private async tavilySearch(query: string, apiKey: string): Promise<TavilyResult[]> {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "basic",
          include_answer: false,
          max_results: 8
        })
      });
      if (!res.ok) {
        this.logger.warn(`Tavily ${res.status} for "${query}"`);
        return [];
      }
      const data = (await res.json()) as { results?: TavilyResult[] };
      return data.results ?? [];
    } catch (err) {
      this.logger.warn(`Tavily fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  private dedupeByUrl(results: TavilyResult[]): TavilyResult[] {
    const seen = new Set<string>();
    const out: TavilyResult[] = [];
    for (const r of results) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      out.push(r);
    }
    return out;
  }

  private isAllowedDomain(url: string): boolean {
    const host = hostnameOf(url);
    if (!host) return false;
    // Deny-list mềm: allow mọi domain trừ blocked. An toàn cho niche thiếu nguồn VN.
    return !BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  }

  private classifyEvidence(domain: string, publishedDate?: string): EvidenceType {
    if (publishedDate) {
      const d = new Date(publishedDate);
      const ageDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 30) return EvidenceType.NEWS;
    }
    if (["shopee.vn", "tiki.vn", "lazada.vn"].some((d) => domain.endsWith(d))) {
      return EvidenceType.PRICE;
    }
    return EvidenceType.FACT;
  }
}
