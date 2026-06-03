import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ChannelRow {
  channel: string;
  clicks: number;
  orders: number;
  revenue: number;
}

/**
 * Loop 3: aggregate ClickLog + ConversionWebhook per channel.
 * Channel = "organic" | "fb" | "zalo" | "email" | "direct" | "other".
 * (AdSpend/ROAS đã cắt ở Refactor V3 — không track chi phí quảng cáo.)
 */
@Injectable()
export class MoneyTrailService {
  constructor(private readonly prisma: PrismaService) {}

  async getByChannel(opts: { days?: number } = {}): Promise<ChannelRow[]> {
    const days = opts.days ?? 7;
    const since = new Date(Date.now() - days * 86400000);

    const clickAgg = await this.prisma.$queryRaw<Array<{ channel: string; clicks: number }>>`
      SELECT COALESCE("channel", 'direct') AS channel, COUNT(*)::int AS clicks
      FROM "ClickLog"
      WHERE "createdAt" >= ${since}
      GROUP BY COALESCE("channel", 'direct')
    `;

    const conversionAgg = await this.prisma.$queryRaw<
      Array<{ channel: string; orders: number; revenue: number }>
    >`
      SELECT COALESCE("channel", 'direct') AS channel,
             COUNT(*)::int AS orders,
             COALESCE(SUM(revenue), 0)::float AS revenue
      FROM "ConversionWebhook"
      WHERE "receivedAt" >= ${since}
      GROUP BY COALESCE("channel", 'direct')
    `;

    const allChannels = new Set<string>([
      ...clickAgg.map((c) => c.channel),
      ...conversionAgg.map((c) => c.channel)
    ]);

    return Array.from(allChannels)
      .map((channel): ChannelRow => {
        const clicks = clickAgg.find((c) => c.channel === channel)?.clicks ?? 0;
        const conv = conversionAgg.find((c) => c.channel === channel);
        const orders = conv?.orders ?? 0;
        const revenue = conv?.revenue ?? 0;
        return { channel, clicks, orders, revenue };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }
}
