import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient } from "../crawler/clients/accesstrade.client";

const ORDER_PRODUCTS_PER_CYCLE_CAP = 50;
const SLEEP_BETWEEN_FETCH_MS = 7000;

/**
 * Loop 2 hook: với mỗi ConversionWebhook reconciled gần đây nhưng chưa có
 * `OrderProduct` rows → pull `/v1/order-products` → save lines. Cap 50/cycle để
 * né AT rate-limit (`/order-products` ~10 req/min).
 *
 * Gọi từ ReconciliationService sau khi order-list match xong.
 */
@Injectable()
export class OrderProductsSyncService {
  private readonly logger = new Logger(OrderProductsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  async syncRecent(cap = ORDER_PRODUCTS_PER_CYCLE_CAP): Promise<{ orderProductsFetched: number }> {
    const candidates = await this.prisma.conversionWebhook.findMany({
      where: {
        atOrderId: { not: null },
        orderProducts: { none: {} }
      },
      take: cap,
      orderBy: { receivedAt: "desc" }
    });

    let total = 0;
    for (const cw of candidates) {
      if (!cw.atOrderId) continue;
      const merchant = this.extractMerchant(cw);
      if (!merchant) {
        this.logger.warn(`[order-products] webhook ${cw.id} không có merchant — skip`);
        continue;
      }
      await sleep(SLEEP_BETWEEN_FETCH_MS);
      try {
        const items = await this.accesstrade.fetchOrderProducts({
          orderId: cw.atOrderId,
          merchant
        });
        for (const item of items) {
          const atProductId = item.atProductId ?? item.product_id ?? null;
          const matchedProductId = atProductId
            ? await this.findMatchedProductId(atProductId)
            : null;

          await this.prisma.orderProduct.upsert({
            where: {
              conversionWebhookId_atOrderProductId: {
                conversionWebhookId: cw.id,
                atOrderProductId: item._id
              }
            },
            create: {
              conversionWebhookId: cw.id,
              atOrderProductId: item._id,
              atCampaignId: item.campaign_id ?? null,
              merchant: item.merchant,
              atProductId,
              productName: item.product_name ?? null,
              productImage: item.product_image ?? null,
              productPrice: item.product_price ?? null,
              productQuantity: item.product_quantity ?? null,
              approvedQuantity: item.quantity?.approved ?? 0,
              pendingQuantity: item.quantity?.pending ?? 0,
              rejectQuantity: item.quantity?.reject ?? 0,
              approvedBilling: item.billing?.approved ?? 0,
              approvedCommission: item.commission?.approved ?? 0,
              salesTime: item.sales_time ? new Date(item.sales_time) : null,
              matchedProductId
            },
            update: {}
          });
          total += 1;
        }
      } catch (err: unknown) {
        this.logger.warn(
          `[order-products] fetch failed cw=${cw.id} order=${cw.atOrderId}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
    return { orderProductsFetched: total };
  }

  private extractMerchant(cw: { payload: unknown }): string | null {
    const payload = cw.payload as Record<string, unknown> | null;
    if (!payload) return null;
    const merchant = payload.merchant ?? payload["atOrder"];
    if (typeof merchant === "string" && merchant.trim()) return merchant.trim();
    if (typeof merchant === "object" && merchant && "merchant" in (merchant as object)) {
      const m = (merchant as Record<string, unknown>).merchant;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
    return null;
  }

  private async findMatchedProductId(atProductId: string): Promise<string | null> {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { scrapedData: { path: ["sourceId"], equals: atProductId } },
          { scrapedData: { path: ["product_id"], equals: atProductId } },
          { scrapedData: { path: ["sourceProductId"], equals: atProductId } }
        ]
      },
      select: { id: true }
    });
    return product?.id ?? null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
