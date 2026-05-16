import { Controller, Get, HttpException, HttpStatus, Logger, Param } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("categories")
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getCategories() {
    try {
      return await this.prisma.category.findMany({
        where: { status: "ACTIVE" },
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    } catch (error: unknown) {
      this.logger.error("Failed to fetch categories", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to fetch categories", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":slug")
  async getCategoryBySlug(@Param("slug") slug: string) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { slug },
        include: {
          products: {
            where: { isPublic: true },
            orderBy: { createdAt: "desc" }
          }
        }
      });

      if (!category) {
        throw new HttpException("Category not found", HttpStatus.NOT_FOUND);
      }

      return category;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch category by slug=${slug}`, error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to fetch category", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
