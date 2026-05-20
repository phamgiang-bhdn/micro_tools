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

/**
 * Tier-1 domain VN cho ảnh + nội dung: ưu tiên ảnh từ đây vì style đồng nhất,
 * chất lượng cao, ảnh sản phẩm thật chứ không phải stock. Match endsWith để
 * cover subdomain (vd m.cellphones.com.vn). Pattern affiliate blog VN —
 * lấy ảnh từ retail/tech site lớn thay vì blog cá nhân.
 */
const TRUSTED_VN_DOMAINS = [
  // Tech review/news
  "cellphones.com.vn", "sforum.vn", "tinhte.vn", "genk.vn", "vnreview.vn",
  "thegioididong.com", "fptshop.com.vn", "didongviet.vn", "hoanghaminhmobile.com",
  "tinhtevn.com",
  // Marketplace (ảnh sản phẩm chính chủ)
  "shopee.vn", "lazada.vn", "tiki.vn", "sendo.vn",
  // Lifestyle / appliances
  "nguyenkim.com", "dienmayxanh.com", "mediamart.vn", "pico.vn",
  // Skincare / cosmetics
  "watsons.vn", "guardian.com.vn", "hasaki.vn"
];

function isTrustedVnDomain(host: string): boolean {
  if (!host) return false;
  return TRUSTED_VN_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}


interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
}

interface TavilyImage {
  url: string;
  description?: string;
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
    const allImages: TavilyImage[] = [];
    for (let i = 0; i < queries.length; i += 1) {
      await ctx.reportProgress?.(
        `Tra cứu Tavily (${i + 1}/${queries.length}): ${queries[i].slice(0, 60)}`,
        Math.round(((i + 1) / queries.length) * 60)
      );
      const { results, images } = await this.tavilySearch(queries[i], apiKey);
      allResults.push(...results);
      allImages.push(...images);
    }

    const deduped = this.dedupeByUrl(allResults);
    // Ưu tiên trusted VN domain → đẩy lên đầu trước khi cap 15. Đảm bảo evidence dẫn dắt
    // Outline/Writer là từ source VN chất lượng cao, không phải blog cá nhân.
    const filtered = deduped
      .filter((r) => this.isAllowedDomain(r.url))
      .sort((a, b) => {
        const ta = isTrustedVnDomain(hostnameOf(a.url));
        const tb = isTrustedVnDomain(hostnameOf(b.url));
        return Number(tb) - Number(ta);
      });
    const top = filtered.slice(0, 15);

    // Dedupe + filter ảnh: bỏ icon nhỏ + blocked domain + thumbnail hiển nhiên (logo, avatar).
    // Ưu tiên TRUSTED_VN_DOMAINS (cellphones, tinhte, genk, retail VN…) → ảnh chất lượng đồng
    // nhất + style affiliate blog VN. Ảnh khác chỉ dùng khi trusted hết suất.
    const imgSeen = new Set<string>();
    const trustedImages: TavilyImage[] = [];
    const otherImages: TavilyImage[] = [];
    for (const img of allImages) {
      if (!img.url || imgSeen.has(img.url)) continue;
      if (!this.isAllowedDomain(img.url)) continue;
      if (/\b(logo|avatar|icon|favicon|sprite)\b/i.test(img.url)) continue;
      imgSeen.add(img.url);
      const host = hostnameOf(img.url);
      if (isTrustedVnDomain(host)) trustedImages.push(img);
      else otherImages.push(img);
    }
    const topImages = [...trustedImages, ...otherImages].slice(0, 12);
    this.logger.log(`Tavily images: ${trustedImages.length} trusted-VN + ${otherImages.length} other → pick ${topImages.length}`);

    await ctx.reportProgress?.(`Lưu nguồn dẫn (${top.length} text + ${topImages.length} ảnh)…`, 75);

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

    // Insert IMAGE evidence từ Tavily images. Mỗi ảnh giữ sourceUrl = URL trang web nguồn
    // (để Image-block render attribution "Ảnh: <domain>" clickable). Image-stage sau sẽ
    // pick ảnh này làm primary cho sections nếu không có product image.
    // LƯU Ý PHÁP LÝ: ảnh thuộc copyright của site nguồn. Hotlinking + attribute là fair-use
    // editorial — pattern phổ thông ở blog VN. Nếu muốn tuyệt đối an toàn → mirror ảnh về
    // S3 + DMCA-ready (phase sau).
    let imgInserted = 0;
    await ctx.reportProgress?.(`Lưu ảnh (${topImages.length})…`, 90);
    for (const img of topImages) {
      const sourceDomain = hostnameOf(img.url);
      const contentHash = sha256(img.url);
      const exists = await this.prisma.articleEvidence.findFirst({
        where: { articleId: ctx.articleId, contentHash }
      });
      if (exists) continue;
      try {
        await this.prisma.articleEvidence.create({
          data: {
            articleId: ctx.articleId,
            type: EvidenceType.IMAGE,
            sourceUrl: img.url,
            sourceDomain,
            title: img.description?.slice(0, 200) ?? null,
            payload: {
              src: img.url,
              attribution: sourceDomain,
              attributionUrl: `https://${sourceDomain}`,
              source: "tavily-web",
              description: img.description ?? null
            } as Prisma.InputJsonValue,
            contentHash
          }
        });
        imgInserted += 1;
      } catch (err) {
        this.logger.warn(`Insert image evidence failed: ${(err as Error).message}`);
      }
    }

    // Đánh dấu evidence "tươi" cho refresh-cycle + UI badge.
    await this.prisma.article.update({
      where: { id: ctx.articleId },
      data: { evidenceFreshAt: new Date() }
    });

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: { queries: queries.length, raw: allResults.length, filtered: filtered.length, inserted, imagesInserted: imgInserted }
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

  private async tavilySearch(query: string, apiKey: string): Promise<{ results: TavilyResult[]; images: TavilyImage[] }> {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "basic",
          include_answer: false,
          include_images: true,
          include_image_descriptions: true,
          max_results: 8
        })
      });
      if (!res.ok) {
        this.logger.warn(`Tavily ${res.status} for "${query}"`);
        return { results: [], images: [] };
      }
      const data = (await res.json()) as {
        results?: TavilyResult[];
        images?: Array<string | { url: string; description?: string }>;
      };
      // Tavily có 2 dạng response: image array dạng string URL hoặc object {url, description}.
      const images: TavilyImage[] = (data.images ?? []).map((img) =>
        typeof img === "string" ? { url: img } : { url: img.url, description: img.description }
      );
      return { results: data.results ?? [], images };
    } catch (err) {
      this.logger.warn(`Tavily fetch failed: ${(err as Error).message}`);
      return { results: [], images: [] };
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
