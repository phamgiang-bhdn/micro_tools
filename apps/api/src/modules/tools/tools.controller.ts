import { Controller, Get, HttpException, HttpStatus, Logger, Param } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("tools")
export class ToolsController {
  private readonly logger = new Logger(ToolsController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getTools() {
    try {
      return await this.prisma.tool.findMany({
        where: { status: "ACTIVE" },
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    } catch (error: unknown) {
      this.logger.error("Failed to fetch tools", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to fetch tools", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(":slug")
  async getToolBySlug(@Param("slug") slug: string) {
    try {
      const tool = await this.prisma.tool.findUnique({
        where: { slug },
        include: {
          products: {
            orderBy: { createdAt: "desc" }
          }
        }
      });

      if (!tool) {
        throw new HttpException("Tool not found", HttpStatus.NOT_FOUND);
      }

      return tool;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch tool by slug=${slug}`, error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to fetch tool", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
