import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { TrackedLink } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient } from "../crawler/clients/accesstrade.client";

export interface CreateTrackedLinkInput {
  title: string;
  originUrl: string;
  channel: string;
  atCampaignId?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  notes?: string;
  createdBy?: string;
}

const MERCHANT_BY_HOST: Array<[RegExp, string]> = [
  [/lazada\.vn/i, "lazada_kol"],
  [/shopee\.vn/i, "shopee"],
  [/tiki\.vn/i, "tiki"],
  [/nguyenkim\.com/i, "nguyenkimvn"],
  [/tiktok\.com/i, "tiktok_cps"]
];

/**
 * Loop 5: tạo AT short_link cho URL bất kỳ → operator post FB/Zalo cá nhân.
 * Auto-detect campaign từ hostname URL (Lazada/Shopee/Tiki...) nếu không specify.
 */
@Injectable()
export class TrackedLinkService {
  private readonly logger = new Logger(TrackedLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  async create(input: CreateTrackedLinkInput): Promise<TrackedLink> {
    let campaignId = input.atCampaignId ?? null;
    if (!campaignId) {
      const detected = await this.detectCampaignFromUrl(input.originUrl);
      if (!detected) {
        throw new HttpException(
          "Không tự nhận diện được campaign từ URL — set atCampaignId thủ công.",
          HttpStatus.BAD_REQUEST
        );
      }
      campaignId = detected;
    }

    const res = await this.accesstrade.createProductLink({
      campaignId,
      urls: [input.originUrl],
      sub1: input.channel,
      sub2: input.sub2,
      sub3: input.sub3,
      sub4: input.sub4,
      utmSource: input.utmSource ?? "external_post",
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
      urlEnc: true
    });

    if (!res.success_link || res.success_link.length === 0) {
      const errors = res.error_link?.map((e) => e.error).join(", ") ?? "unknown";
      throw new HttpException(
        `AT từ chối tạo link: ${errors}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const linkData = res.success_link[0];

    return this.prisma.trackedLink.create({
      data: {
        title: input.title,
        originUrl: input.originUrl,
        atCampaignId: campaignId,
        atAffLink: linkData.aff_link,
        atShortLink: linkData.short_link,
        channel: input.channel,
        sub1: input.channel,
        sub2: input.sub2 ?? null,
        sub3: input.sub3 ?? null,
        sub4: input.sub4 ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmContent: input.utmContent ?? null,
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null
      }
    });
  }

  private async detectCampaignFromUrl(rawUrl: string): Promise<string | null> {
    let host = "";
    try {
      host = new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return null;
    }
    const entry = MERCHANT_BY_HOST.find(([rx]) => rx.test(host));
    if (!entry) return null;
    const merchantSlug = entry[1];
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        merchantName: { equals: merchantSlug, mode: "insensitive" },
        status: "APPROVED",
        atCampaignId: { not: null }
      },
      select: { atCampaignId: true }
    });
    return campaign?.atCampaignId ?? null;
  }

  async list(opts: { channel?: string; limit?: number; offset?: number }) {
    return this.prisma.trackedLink.findMany({
      where: opts.channel ? { channel: opts.channel } : undefined,
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0
    });
  }

  async getKpi(opts: { days?: number } = {}) {
    const days = opts.days ?? 7;
    const since = new Date(Date.now() - days * 86400000);
    const links = await this.prisma.trackedLink.findMany({
      where: { createdAt: { gte: since } }
    });
    const byChannel: Record<string, { links: number; revenue: number }> = {};
    for (const l of links) {
      const c = byChannel[l.channel] ?? { links: 0, revenue: 0 };
      c.links += 1;
      c.revenue += l.revenue;
      byChannel[l.channel] = c;
    }
    return {
      totalLinks: links.length,
      activeLinks: links.filter((l) => l.isActive).length,
      totalClicks: links.reduce((s, l) => s + l.clickCount, 0),
      totalConversions: links.reduce((s, l) => s + l.conversionCount, 0),
      totalRevenue: links.reduce((s, l) => s + l.revenue, 0),
      byChannel
    };
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.trackedLink.update({
      where: { id },
      data: { isActive }
    });
  }
}
