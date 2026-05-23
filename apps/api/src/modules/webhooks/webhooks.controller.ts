/**
 * Webhook endpoint nhận postback từ Accesstrade.
 *
 * Hiện chỉ accept Accesstrade. Khi onboard network khác (Shopee/Lazada direct):
 * thêm `@Post('<network-slug>')` mới với handler riêng (parse shape riêng, không generic
 * polymorphic). Sprint at-money-flows-v1 STORY-01 đã remove 3 stub Shopee/TikTok/Lazada
 * để giảm surface area + tránh confuse "có phải bật cái này không?".
 */
import { Body, Controller, HttpCode, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { AffiliateNetwork, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../utils/slug.util";

interface ConversionWebhookPayload {
  trackingCode?: string;
  sub_id?: string;
  subId?: string;
  click_id?: string;
  clickId?: string;
  revenue?: number | string;
  status?: string;
  campaign?: string;
  campaign_name?: string;
  campaignName?: string;
  merchant?: string;
  [key: string]: unknown;
}

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post("accesstrade")
  @HttpCode(HttpStatus.OK)
  async handleAccessTradeWebhook(@Body() payload: ConversionWebhookPayload): Promise<{ success: true }> {
    return this.recordConversion(AffiliateNetwork.ACCESSTRADE, payload);
  }

  private async recordConversion(
    network: AffiliateNetwork,
    payload: ConversionWebhookPayload
  ): Promise<{ success: true }> {
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

      const campaignId = await this.resolveCampaignId(network, payload);

      // STORY-06: copy channel attribution from matching ClickLog (first-touch).
      const click = await this.prisma.clickLog.findUnique({
        where: { trackingCode },
        select: { channel: true }
      });
      const channel = click?.channel ?? "direct";

      await this.prisma.conversionWebhook.create({
        data: {
          trackingCode,
          network,
          campaignId,
          revenue: new Prisma.Decimal(revenueNumber.toFixed(2)),
          status,
          channel,
          payload: payload as Prisma.InputJsonValue
        }
      });

      this.logger.log(`Webhook stored network=${network} trackingCode=${trackingCode} channel=${channel}`);
      return { success: true };
    } catch (error: unknown) {
      this.logger.error(
        `${network} webhook processing failed`,
        error instanceof Error ? error.stack : String(error)
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException("Failed to process webhook", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async resolveCampaignId(
    network: AffiliateNetwork,
    payload: ConversionWebhookPayload
  ): Promise<string | null> {
    const name = payload.campaign ?? payload.campaign_name ?? payload.campaignName;
    if (typeof name !== "string" || !name.trim()) return null;
    const externalId = slugify(name);
    if (!externalId) return null;
    const found = await this.prisma.campaign.findUnique({
      where: { network_externalId: { network, externalId } },
      select: { id: true }
    });
    return found?.id ?? null;
  }
}
