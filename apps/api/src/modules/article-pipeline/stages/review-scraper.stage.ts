import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus, EvidenceType, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext
} from "../pipeline.types";
import { sha256 } from "../utils/http";

/**
 * Review Scraper — Sprint 2 v1.
 *
 * Strategy:
 *  1. Đọc Article.pinnedProductIds + productIds.
 *  2. Per product: check ProductReview rows đã có trong DB (cào trước đó qua admin tool hoặc cron).
 *     Nếu có ≥ MIN_PER_PRODUCT → tạo ArticleEvidence từ review.
 *  3. Provider="accesstrade": tương lai có thể call AT product detail nếu API có review field
 *     (hiện tại AT datafeed không expose review; Sprint sau bổ sung nếu cần).
 *  4. Provider="playwright": Sprint 3 nếu cần (ToS Shopee/Tiki/Lazada — rủi ro pháp lý → cần legal review).
 *
 * Hiện tại: nếu DB chưa có ProductReview → skip với warning. Admin có thể seed thủ công qua
 * POST /admin/product-reviews (Sprint 2.9).
 */
@Injectable()
export class ReviewScraperStage implements PipelineStage {
  readonly name = PipelineStageName.REVIEW_SCRAPER;
  readonly agent = "review-scraper@v2";
  private readonly logger = new Logger(ReviewScraperStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: StageContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: ctx.articleId },
      select: { pinnedProductIds: true, productIds: true, type: true }
    });
    if (!article) throw new Error("Article not found");

    const productIds = Array.from(
      new Set([...(article.pinnedProductIds ?? []), ...(article.productIds ?? [])])
    );

    await ctx.reportProgress?.(`Quét đánh giá ${productIds.length} sản phẩm…`, 10);

    if (productIds.length === 0) {
      this.logger.log(
        `No product context for article ${ctx.articleId} — skip review scraping (buying guide without pinned products)`
      );
      return {
        nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
        outputSummary: { productCount: 0, skipped: true }
      };
    }

    const minPer = 10;
    let totalReviewsLinked = 0;
    const productsBelowMin: string[] = [];

    for (let i = 0; i < productIds.length; i += 1) {
      const pid = productIds[i];
      await ctx.reportProgress?.(
        `Đọc đánh giá sản phẩm ${i + 1}/${productIds.length}…`,
        20 + Math.round(((i + 1) / productIds.length) * 70)
      );
      const reviews = await this.prisma.productReview.findMany({
        where: { productId: pid },
        orderBy: [{ rating: "desc" }, { reviewDate: "desc" }],
        take: 20
      });

      if (reviews.length < minPer) {
        productsBelowMin.push(pid);
        // Tiếp tục: dùng những review đã có (nếu nhiều bài cùng product cần review).
      }

      for (const r of reviews) {
        const payload = {
          productId: r.productId,
          author: r.author,
          rating: r.rating,
          title: r.title,
          body: r.body,
          verifiedBuyer: r.verifiedBuyer,
          reviewDate: r.reviewDate,
          sentiment: r.sentiment,
          topicTags: r.topicTags,
          reviewId: r.id
        };
        const contentHash = sha256(`review:${r.id}`);
        const exists = await this.prisma.articleEvidence.findFirst({
          where: { articleId: ctx.articleId, contentHash }
        });
        if (exists) continue;

        try {
          await this.prisma.articleEvidence.create({
            data: {
              articleId: ctx.articleId,
              type: EvidenceType.REVIEW,
              productId: r.productId,
              sourceUrl: r.sourceUrl ?? `internal://review/${r.id}`,
              sourceDomain: r.source,
              title: r.title ?? r.body.slice(0, 80),
              payload: payload as Prisma.InputJsonValue,
              contentHash
            }
          });
          totalReviewsLinked += 1;
        } catch (err) {
          this.logger.warn(`Insert review evidence failed: ${(err as Error).message}`);
        }
      }
    }

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: {
        productCount: productIds.length,
        reviewsLinked: totalReviewsLinked,
        productsBelowMin: productsBelowMin.length,
        note:
          productsBelowMin.length > 0
            ? `${productsBelowMin.length} product(s) chưa đủ ${minPer} review — admin nên seed thêm qua POST /admin/product-reviews`
            : "all products have enough reviews"
      }
    };
  }
}
