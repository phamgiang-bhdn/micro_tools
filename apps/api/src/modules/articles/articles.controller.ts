import { Controller, Get, HttpException, HttpStatus, Param, Query } from "@nestjs/common";
import { ArticleType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("articles")
export class ArticlesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query("type") type?: string,
    @Query("toolSlug") toolSlug?: string,
    @Query("limit") limit = "20"
  ) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const where: Prisma.ArticleWhereInput = { status: "PUBLISHED" };

    if (type && (Object.values(ArticleType) as string[]).includes(type)) {
      where.type = type as ArticleType;
    }

    if (toolSlug) {
      const tool = await this.prisma.tool.findUnique({ where: { slug: toolSlug } });
      if (!tool) return [];
      where.toolId = tool.id;
    }

    return this.prisma.article.findMany({
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
        tool: { select: { slug: true, name: true } }
      }
    });
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        tool: { select: { slug: true, name: true } }
      }
    });

    if (!article || article.status !== "PUBLISHED") {
      throw new HttpException("Article not found", HttpStatus.NOT_FOUND);
    }

    const products =
      article.productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: article.productIds } },
            include: { tool: { select: { slug: true, name: true } } }
          })
        : [];

    return { ...article, products };
  }
}
