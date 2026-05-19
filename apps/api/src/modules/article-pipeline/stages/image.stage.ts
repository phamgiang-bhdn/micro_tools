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

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string };
  width: number;
  height: number;
  user: { name: string; links: { html: string } };
  alt_description: string | null;
  description: string | null;
  links: { html: string };
}

@Injectable()
export class ImageStage implements PipelineStage {
  readonly name = PipelineStageName.IMAGE;
  readonly agent = "image@v2";
  private readonly logger = new Logger(ImageStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      select: { briefJson: true, pinnedProductIds: true, topic: true, title: true }
    });
    if (!article) throw new Error("Article not found");

    const sections = await this.prisma.articleSection.findMany({
      where: { articleId: ctx.articleId },
      orderBy: { order: "asc" }
    });

    let attached = 0;

    await ctx.reportProgress?.("Chọn ảnh bìa…", 10);

    // 1. Cover from pinned product (Sprint 2 v1: chỉ lấy ảnh product). Sprint sau: AI sinh ảnh hero.
    if (article.pinnedProductIds.length > 0) {
      const productImg = await this.pickProductImage(article.pinnedProductIds);
      if (productImg) {
        await this.prisma.article.update({
          where: { id: ctx.articleId },
          data: {
            coverImage: productImg,
            coverImageAttribution: { source: "product", credit: null } as Prisma.InputJsonValue
          }
        });
      }
    }

    // 2. Per section cần image → tìm Unsplash
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    const brief = (article.briefJson ?? null) as ArticleBrief | null;
    const baseKeyword = (brief?.targetKeywords?.[0] ?? article.topic ?? article.title).trim();
    let coverSet = !!article.pinnedProductIds.length;

    const sectionsNeeding = sections.filter((s) =>
      s.blockTypeHints.some((t) => t === "image" || t === "image_gallery")
    );

    for (let idx = 0; idx < sectionsNeeding.length; idx += 1) {
      const section = sectionsNeeding[idx];
      await ctx.reportProgress?.(
        `Tìm ảnh cho phần "${section.heading.slice(0, 50)}" (${idx + 1}/${sectionsNeeding.length})`,
        15 + Math.round(((idx + 1) / Math.max(1, sectionsNeeding.length)) * 75)
      );

      if (!unsplashKey) {
        this.logger.warn(`UNSPLASH_ACCESS_KEY missing — skip image for section "${section.heading}"`);
        continue;
      }

      const keyword = `${baseKeyword} ${section.intent ?? ""}`.trim();
      const photo = await this.unsplashSearch(keyword, unsplashKey);
      if (!photo) continue;

      const attribution = {
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        source: "Unsplash",
        sourceUrl: photo.links.html,
        license: "Unsplash License",
        providerId: photo.id
      };

      const evidence = await this.prisma.articleEvidence.create({
        data: {
          articleId: ctx.articleId,
          type: EvidenceType.IMAGE,
          sourceUrl: photo.links.html,
          sourceDomain: hostnameOf(photo.links.html),
          title: photo.alt_description ?? photo.description ?? keyword,
          payload: {
            src: photo.urls.regular,
            width: photo.width,
            height: photo.height,
            attribution: photo.user.name,
            attributionUrl: photo.user.links.html,
            license: "Unsplash License (free for commercial/editorial with attribution)",
            providerId: photo.id
          } as Prisma.InputJsonValue,
          contentHash: sha256(photo.urls.regular)
        }
      });

      await this.prisma.articleSection.update({
        where: { id: section.id },
        data: {
          evidenceRefs: { set: [...section.evidenceRefs, evidence.id] }
        }
      });

      // Nếu chưa có cover từ product, dùng ảnh đầu tiên từ Unsplash làm cover (kèm attribution).
      if (!coverSet) {
        await this.prisma.article.update({
          where: { id: ctx.articleId },
          data: {
            coverImage: photo.urls.regular,
            coverImageAttribution: attribution as Prisma.InputJsonValue
          }
        });
        coverSet = true;
      }

      attached += 1;
    }

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: { imagesAttached: attached, sectionCount: sections.length }
    };
  }

  private async pickProductImage(productIds: string[]): Promise<string | null> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, scrapedData: true }
    });
    for (const p of products) {
      const data = (p.scrapedData ?? {}) as Record<string, unknown>;
      const img = data.image ?? data.imageUrl ?? data.thumbnail;
      if (typeof img === "string" && img.startsWith("http")) return img;
    }
    return null;
  }

  private async unsplashSearch(query: string, accessKey: string): Promise<UnsplashPhoto | null> {
    try {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", "5");
      url.searchParams.set("orientation", "landscape");
      url.searchParams.set("content_filter", "high");
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" }
      });
      if (!res.ok) {
        this.logger.warn(`Unsplash ${res.status} for "${query}"`);
        return null;
      }
      const data = (await res.json()) as { results?: UnsplashPhoto[] };
      const photos = (data.results ?? []).filter((p) => p.width >= 1200);
      return photos[0] ?? null;
    } catch (err) {
      this.logger.warn(`Unsplash fetch failed: ${(err as Error).message}`);
      return null;
    }
  }
}
