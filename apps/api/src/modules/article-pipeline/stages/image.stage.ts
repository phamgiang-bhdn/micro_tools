import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, EvidenceType, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext
} from "../pipeline.types";
import { hostnameOf, sha256 } from "../utils/http";

@Injectable()
export class ImageStage implements PipelineStage {
  readonly name = PipelineStageName.IMAGE;
  readonly agent = "image@v2";
  private readonly logger = new Logger(ImageStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      select: { pinnedProductIds: true, productIds: true }
    });
    if (!article) throw new Error("Article not found");

    const sections = await this.prisma.articleSection.findMany({
      where: { articleId: ctx.articleId },
      orderBy: { order: "asc" }
    });

    let attached = 0;

    await ctx.reportProgress?.("Lấy ảnh sản phẩm + web…", 10);

    // Nguồn ảnh theo thứ tự ưu tiên:
    // 1. Product image (scrapedData.image/images[]) — trust nhất, là sản phẩm thật của ta
    // 2. Web image (IMAGE evidence Research stage đã cào về từ Tavily) — ảnh từ tech blog/news
    //    site VN có sourceUrl rõ ràng để credit
    // Bỏ Unsplash stock — ảnh studio chung chung không phù hợp tone affiliate.
    // Section không có ảnh → admin replace tay qua UI "Quản lý ảnh" trong tab Các phần.
    const productImages = await this.collectProductImages([
      ...article.pinnedProductIds,
      ...article.productIds
    ]);
    const webImages = await this.collectWebImagesFromEvidence(ctx.articleId);

    // 1. Cover: ưu tiên product → fallback web
    let coverSet = false;
    if (productImages.length > 0) {
      await this.prisma.article.update({
        where: { id: ctx.articleId },
        data: {
          coverImage: productImages[0].src,
          coverImageAttribution: { source: "product", credit: productImages[0].productName ?? null } as Prisma.InputJsonValue
        }
      });
      coverSet = true;
    } else if (webImages.length > 0) {
      await this.prisma.article.update({
        where: { id: ctx.articleId },
        data: {
          coverImage: webImages[0].src,
          coverImageAttribution: { source: "web", credit: webImages[0].sourceDomain, sourceUrl: webImages[0].sourceUrl } as Prisma.InputJsonValue
        }
      });
      coverSet = true;
    }

    // 2. Per section: round-robin product → web. Hết → để trống, admin replace tay.
    const sectionsNeeding = sections.filter((s) =>
      s.blockTypeHints.some((t) => t === "image" || t === "image_gallery")
    );

    // Track ảnh đã dùng để tránh trùng giữa section.
    const usedWebSrcs = new Set<string>();
    const usedProductSrcs = new Set<string>();

    for (let idx = 0; idx < sectionsNeeding.length; idx += 1) {
      const section = sectionsNeeding[idx];
      await ctx.reportProgress?.(
        `Gắn ảnh phần "${section.heading.slice(0, 50)}" (${idx + 1}/${sectionsNeeding.length})`,
        15 + Math.round(((idx + 1) / Math.max(1, sectionsNeeding.length)) * 75)
      );

      // Ưu tiên 1: product image (round-robin, không dùng lại trừ khi hết)
      const productImg = productImages.find((p) => !usedProductSrcs.has(p.src))
        ?? productImages[idx % Math.max(1, productImages.length)];
      if (productImg) {
        usedProductSrcs.add(productImg.src);
        const evidence = await this.prisma.articleEvidence.create({
          data: {
            articleId: ctx.articleId,
            type: EvidenceType.IMAGE,
            sourceUrl: productImg.src,
            sourceDomain: hostnameOf(productImg.src) ?? "product",
            title: productImg.productName ?? `Ảnh: ${section.heading}`.slice(0, 200),
            payload: {
              src: productImg.src,
              attribution: productImg.productName ?? "Ảnh sản phẩm",
              attributionUrl: productImg.productUrl ?? null,
              source: "product"
            } as Prisma.InputJsonValue,
            contentHash: sha256(productImg.src + section.id)
          }
        });
        await this.prisma.articleSection.update({
          where: { id: section.id },
          data: { evidenceRefs: { set: [...section.evidenceRefs, evidence.id] } }
        });
        attached += 1;
        continue;
      }

      // Ưu tiên 2: web image từ Tavily (đã có evidence row, chỉ link vào section)
      const webImg = webImages.find((w) => !usedWebSrcs.has(w.src));
      if (webImg) {
        usedWebSrcs.add(webImg.src);
        await this.prisma.articleSection.update({
          where: { id: section.id },
          data: { evidenceRefs: { set: [...section.evidenceRefs, webImg.evidenceId] } }
        });
        attached += 1;
        continue;
      }

      // Không còn nguồn ảnh — log + skip. Admin có thể replace tay qua UI sau Writer xong.
      this.logger.debug(`Section "${section.heading}" thiếu ảnh — admin sẽ replace tay nếu cần`);
    }

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: {
        imagesAttached: attached,
        sectionCount: sections.length,
        productImagesAvailable: productImages.length
      }
    };
  }

  /**
   * Lấy IMAGE evidence từ Research stage đã cào về (Tavily web image search).
   * Filter những ảnh chưa link vào section nào để tránh dùng trùng.
   * sourceUrl của evidence là URL ảnh trên trang web nguồn (để attribute).
   */
  private async collectWebImagesFromEvidence(
    articleId: string
  ): Promise<Array<{ evidenceId: string; src: string; sourceUrl: string; sourceDomain: string }>> {
    const rows = await this.prisma.articleEvidence.findMany({
      where: {
        articleId,
        type: EvidenceType.IMAGE,
        // chỉ web image (source=tavily-web trong payload). product images insert sau, không có row evidence
        // riêng vì product image insert vào Section evidenceRefs trực tiếp.
      },
      orderBy: { fetchedAt: "asc" }
    });
    const out: Array<{ evidenceId: string; src: string; sourceUrl: string; sourceDomain: string }> = [];
    for (const r of rows) {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      if (payload.source !== "tavily-web") continue;
      const src = typeof payload.src === "string" ? payload.src : null;
      if (!src) continue;
      out.push({
        evidenceId: r.id,
        src,
        sourceUrl: r.sourceUrl,
        sourceDomain: r.sourceDomain
      });
    }
    return out;
  }

  /**
   * Quét scrapedData của products để gom ảnh thật. Hỗ trợ multiple key aliases
   * (image / imageUrl / thumbnail / images[]) vì schema per-niche dynamic.
   */
  private async collectProductImages(productIds: string[]): Promise<Array<{ src: string; productName?: string; productUrl?: string }>> {
    const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, scrapedData: true, affiliateUrl: true }
    });

    const out: Array<{ src: string; productName?: string; productUrl?: string }> = [];
    for (const p of products) {
      const data = (p.scrapedData ?? {}) as Record<string, unknown>;
      // Single image fields
      for (const k of ["image", "imageUrl", "thumbnail", "mainImage", "primaryImage"]) {
        const v = data[k];
        if (typeof v === "string" && /^https?:\/\//.test(v)) {
          out.push({ src: v, productName: p.name, productUrl: p.affiliateUrl ?? undefined });
          break;
        }
      }
      // Array images field (tối đa 3 ảnh/product để không spam 1 product)
      const imgs = data.images;
      if (Array.isArray(imgs)) {
        for (const img of imgs.slice(0, 3)) {
          if (typeof img === "string" && /^https?:\/\//.test(img)) {
            out.push({ src: img, productName: p.name, productUrl: p.affiliateUrl ?? undefined });
          } else if (img && typeof img === "object") {
            const url = (img as Record<string, unknown>).url ?? (img as Record<string, unknown>).src;
            if (typeof url === "string" && /^https?:\/\//.test(url)) {
              out.push({ src: url, productName: p.name, productUrl: p.affiliateUrl ?? undefined });
            }
          }
        }
      }
    }
    return out;
  }

}
