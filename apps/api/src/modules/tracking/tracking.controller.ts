import { Body, Controller, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

interface TrackClickPayload {
  productId: string;
  trackingCode: string;
  ipAddress: string;
  userAgent?: string;
}

@Controller("tracking")
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post("click")
  async logClick(@Body() body: TrackClickPayload): Promise<{ success: boolean }> {
    try {
      if (!body.productId || !body.trackingCode) {
        throw new HttpException("productId and trackingCode are required", HttpStatus.BAD_REQUEST);
      }

      const ipHash = createHash("sha256").update(body.ipAddress || randomUUID()).digest("hex");

      await this.prisma.clickLog.create({
        data: {
          productId: body.productId,
          trackingCode: body.trackingCode,
          ipHash,
          userAgent: body.userAgent?.slice(0, 1024) ?? null
        }
      });

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error("Failed to insert ClickLog", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Failed to track click", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
