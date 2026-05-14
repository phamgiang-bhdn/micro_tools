import { Body, Controller, HttpCode, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

interface AccessTradeWebhookPayload {
  trackingCode?: string;
  sub_id?: string;
  subId?: string;
  click_id?: string;
  clickId?: string;
  revenue?: number | string;
  status?: string;
  [key: string]: unknown;
}

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post("accesstrade")
  @HttpCode(HttpStatus.OK)
  async handleAccessTradeWebhook(@Body() payload: AccessTradeWebhookPayload): Promise<{ success: true }> {
    try {
      const trackingCode =
        payload.trackingCode ?? payload.sub_id ?? payload.subId ?? payload.click_id ?? payload.clickId;

      if (!trackingCode || typeof trackingCode !== "string") {
        throw new HttpException("Missing tracking code in payload", HttpStatus.BAD_REQUEST);
      }

      const revenueRaw = payload.revenue ?? "0";
      const revenueNumber = Number(revenueRaw);
      const status = typeof payload.status === "string" ? payload.status : "received";

      if (!Number.isFinite(revenueNumber)) {
        throw new HttpException("Invalid revenue value", HttpStatus.BAD_REQUEST);
      }

      await this.prisma.conversionWebhook.create({
        data: {
          trackingCode,
          revenue: new Prisma.Decimal(revenueNumber.toFixed(2)),
          status,
          payload: payload as Prisma.InputJsonValue
        }
      });

      this.logger.log(`Webhook stored for trackingCode=${trackingCode}`);
      return { success: true };
    } catch (error: unknown) {
      this.logger.error("AccessTrade webhook processing failed", error instanceof Error ? error.stack : String(error));
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException("Failed to process webhook", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
