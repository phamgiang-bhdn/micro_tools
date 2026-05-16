import { Controller, Get, HttpException, HttpStatus, Param, Query } from "@nestjs/common";
import { ArticleType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("articles")
export class ArticlesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query("type") type?: string,
    @Query("categorySlug") categorySlug?: string,
    @Query("limit") limit = "20"
  ) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const where: Prisma.ArticleWhereInput = { status: "PUBLISHED" };

    if (type && (Object.values(ArticleType) as string[]).includes(type)) {
      where.type = type as ArticleType;
    }

    if (categorySlug) {
      const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!category) return [];
      where.categoryId = category.id;
    }

    const articles = await this.prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: parsedLimit,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        type: true,
        publishedAt: true,
        productIds: true,
        category: { select: { slug: true, name: true } }
      }
    });

    const allProductIds = [...new Set(articles.flatMap((a) => a.productIds))];
    const products = allProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: allProductIds }, isPublic: true },
          select: { id: true, scrapedData: true }
        })
      : [];

    const articleCovers = await this.prisma.article.findMany({
      where: { id: { in: articles.map((a) => a.id) } },
      select: { id: true, coverImage: true }
    });
    const coverById = new Map(articleCovers.map((a) => [a.id, a.coverImage]));

    const imageMap = new Map<string, string>();
    for (const p of products) {
      const raw = (p.scrapedData ?? {}) as Record<string, unknown>;
      const img = pickImage(raw);
      if (img) imageMap.set(p.id, img);
    }

    return articles.map(({ productIds, ...rest }) => ({
      ...rest,
      coverImage:
        coverById.get(rest.id) ??
        productIds.map((id) => imageMap.get(id)).find(Boolean) ??
        null
    }));
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        category: { select: { slug: true, name: true } }
      }
    });
    // article.coverImage included via spread below.

    if (!article || article.status !== "PUBLISHED") {
      throw new HttpException("Article not found", HttpStatus.NOT_FOUND);
    }

    const products =
      article.productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: article.productIds }, isPublic: true },
            include: { category: { select: { slug: true, name: true } } }
          })
        : [];

    return { ...article, products };
  }
}

function pickImage(raw: Record<string, unknown>): string | undefined {
  for (const key of ["image", "imageUrl", "thumbnail", "photo"]) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}
