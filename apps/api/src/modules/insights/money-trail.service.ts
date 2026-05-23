import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ChannelRow {
  channel: string;
  clicks: number;
  orders: number;
  revenue: number;
  spend: number;
  roas: number | null;
}

/**
 * Loop 3: aggregate ClickLog + ConversionWebhook per channel + AdSpend → ROAS.
 * Channel = "organic" | "fb" | "zalo" | "email" | "direct" | "other".
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

    const weekStart = computeMondayVN();
    const adSpend = await this.prisma.adSpend.findMany({
      where: { weekStartDate: weekStart }
    });

    const allChannels = new Set<string>([
      ...clickAgg.map((c) => c.channel),
      ...conversionAgg.map((c) => c.channel),
      ...adSpend.map((a) => a.channel)
    ]);

    return Array.from(allChannels)
      .map((channel): ChannelRow => {
        const clicks = clickAgg.find((c) => c.channel === channel)?.clicks ?? 0;
        const conv = conversionAgg.find((c) => c.channel === channel);
        const orders = conv?.orders ?? 0;
        const revenue = conv?.revenue ?? 0;
        const spend = adSpend.find((a) => a.channel === channel)?.amount ?? 0;
        const roas = spend > 0 ? revenue / spend : null;
        return { channel, clicks, orders, revenue, spend, roas };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }
}

function computeMondayVN(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}
