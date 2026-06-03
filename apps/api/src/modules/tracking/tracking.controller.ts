import { Body, Controller, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

interface TrackClickPayload {
  productId: string;
  trackingCode: string;
  ipAddress: string;
  userAgent?: string;
  /** STORY-06: channel attribution gắn lúc click. */
  channel?: string;
  attributionSource?: string;
  /** STORY-07: signal A/B uplift cho coupon-inline pill. */
  hasInlineCoupon?: boolean;
  /** Tool tracking (AI-visible refactor). */
  toolId?: string;
  quizSessionId?: string;
  /** "tiki" | "shopee" | "lazada" | "tiktokshop" — multi-marketplace per click. */
  marketplace?: string;
}

const ALLOWED_CHANNELS = new Set(["organic", "fb", "zalo", "email", "direct", "other"]);
const ALLOWED_MARKETPLACES = new Set(["tiki", "shopee", "lazada", "tiktokshop", "default"]);

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

      const channelInput = (body.channel ?? "direct").toLowerCase();
      const channel = ALLOWED_CHANNELS.has(channelInput) ? channelInput : "other";

      const mpInput = body.marketplace?.toLowerCase();
      const marketplace = mpInput && ALLOWED_MARKETPLACES.has(mpInput) ? mpInput : null;

      await this.prisma.clickLog.create({
        data: {
          productId: body.productId,
          trackingCode: body.trackingCode,
          ipHash,
          userAgent: body.userAgent?.slice(0, 1024) ?? null,
          channel,
          subId1: channel,
          attributionSource: body.attributionSource?.slice(0, 40) ?? null,
          hasInlineCoupon: Boolean(body.hasInlineCoupon),
          toolId: body.toolId ?? null,
          quizSessionId: body.quizSessionId ?? null,
          marketplace
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
