import { Controller, Get, HttpException, HttpStatus, Logger, Param } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("niches")
export class NichesController {
  private readonly logger = new Logger(NichesController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getNiches() {
    try {
      return await this.prisma.niche.findMany({
        where: { status: "ACTIVE" },
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    } catch (error: unknown) {
      this.logger.error("Failed to fetch niches", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to fetch niches", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":slug")
  async getNicheBySlug(@Param("slug") slug: string) {
    try {
      const niche = await this.prisma.niche.findUnique({
        where: { slug },
        include: {
          products: {
            where: { isPublic: true },
            orderBy: { createdAt: "desc" },
            include: {
              campaign: {
                select: { id: true, name: true, merchantName: true }
              }
            }
          }
        }
      });

      if (!niche) {
        throw new HttpException("Niche not found", HttpStatus.NOT_FOUND);
      }

      return niche;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch niche by slug=${slug}`, error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to fetch niche", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
