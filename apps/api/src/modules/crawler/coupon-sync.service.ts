import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SyncStatusService } from "../../services/sync-status.service";
import { sanitizeCouponHtml } from "../../common/sanitize-html.util";
import {
  AccesstradeClient,
  AtCoupon,
  AtKeyword,
  AtMerchant
} from "./clients/accesstrade.client";

export interface CouponSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
}

export const COUPON_SYNC_KEYWORDS_PER_MERCHANT = 5;
export const COUPON_SYNC_COUPONS_PER_KEYWORD = 20;
export const COUPON_SYNC_SLEEP_MS = 7000;

@Injectable()
export class CouponSyncService {
  private readonly logger = new Logger(CouponSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient,
    private readonly syncStatus: SyncStatusService
  ) {}

  async syncFromAccesstrade(): Promise<CouponSyncResult> {
    return this.syncStatus.wrap("coupon", () => this.syncFromAccesstradeInner());
  }

  private async syncFromAccesstradeInner(): Promise<CouponSyncResult> {
    const atMerchants = await this.accesstrade.fetchMerchantsWithCoupons();
    if (atMerchants.length === 0) {
      this.logger.warn("Coupon sync: AT trả 0 merchant — skip");
      return { fetched: 0, created: 0, updated: 0, skipped: 0 };
    }

    const ourCampaigns = await this.prisma.campaign.findMany({
      where: { status: "APPROVED", merchantName: { not: null } },
      select: { id: true, merchantName: true }
    });
    const merchantToCampaign = new Map<string, string>();
    for (const c of ourCampaigns) {
      if (c.merchantName) {
        merchantToCampaign.set(c.merchantName.toLowerCase(), c.id);
      }
    }

    const relevantMerchants = atMerchants.filter((m) =>
      merchantToCampaign.has(m.login_name.toLowerCase())
    );
    this.logger.log(
      `Coupon sync: ${atMerchants.length} AT merchants, ${relevantMerchants.length} match our approved campaigns`
    );
    if (relevantMerchants.length === 0) {
      this.logger.warn("Coupon sync: No merchant matched — sync skipped");
      return { fetched: 0, created: 0, updated: 0, skipped: 0 };
    }

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const merchant of relevantMerchants) {
      const campaignId = merchantToCampaign.get(merchant.login_name.toLowerCase());
      if (!campaignId) continue;
      const keywords = await this.accesstrade.fetchKeywordsByMerchant(merchant.id);
      await this.sleep(COUPON_SYNC_SLEEP_MS);

      for (const kw of keywords.slice(0, COUPON_SYNC_KEYWORDS_PER_MERCHANT)) {
        const coupons = await this.accesstrade.fetchCouponsByKeyword(
          kw.id,
          COUPON_SYNC_COUPONS_PER_KEYWORD
        );
        await this.sleep(COUPON_SYNC_SLEEP_MS);
        fetched += coupons.length;

        for (const c of coupons) {
          const counter = await this.upsertCoupon(c, kw, merchant, campaignId);
          if (counter === "skipped") skipped += 1;
          else if (counter === "created") created += 1;
          else updated += 1;
        }
      }
    }

    this.logger.log(
      `Coupon sync done: fetched=${fetched} created=${created} updated=${updated} skipped=${skipped}`
    );
    return { fetched, created, updated, skipped };
  }

  private async upsertCoupon(
    c: AtCoupon,
    kw: AtKeyword,
    merchant: AtMerchant,
    campaignId: string
  ): Promise<"created" | "updated" | "skipped"> {
    if (!c.id) return "skipped";

    const existing = await this.prisma.coupon.findUnique({ where: { atCouponId: c.id } });
    const data = {
      atCouponId: c.id,
      code: c.id,
      description: c.name ?? null,
      merchantSlug: merchant.login_name,
      merchantDisplay: merchant.display_name,
      merchantLogo: merchant.logo,
      iconText: kw.icon_text,
      iconTextId: kw.id,
      campaignId,
      contentHtml: sanitizeCouponHtml(c.content),
      imageUrl: c.image ?? null,
      bannersJson: ((c.banners ?? []) as unknown) as Prisma.InputJsonValue,
      domain: c.domain ?? null,
      prodLink: c.prod_link ?? null,
      affiliateUrl: c.link ?? null,
      startsAt: c.start_time ? new Date(c.start_time) : null,
      expiresAt: c.end_time ? new Date(c.end_time) : null,
      discountPercent:
        typeof c.discount_percentage === "number" ? Math.round(c.discount_percentage) : null,
      discountAmount:
        typeof c.discount_value === "number" ? new Prisma.Decimal(c.discount_value) : null,
      coinCap: typeof c.coin_cap === "number" ? new Prisma.Decimal(c.coin_cap) : null,
      coinPercentage:
        typeof c.coin_percentage === "number" ? new Prisma.Decimal(c.coin_percentage) : null,
      percentageUsed:
        typeof c.percentage_used === "number" ? new Prisma.Decimal(c.percentage_used) : null,
      atRawData: (c as unknown) as Prisma.InputJsonValue,
      atLastSyncedAt: new Date(),
      network: AffiliateNetwork.ACCESSTRADE
    };

    if (existing) {
      await this.prisma.coupon.update({ where: { id: existing.id }, data });
      return "updated";
    }
    await this.prisma.coupon.create({
      data: { ...data, isActive: false }
    });
    return "created";
  }

  // Exposed seam for testing rate-limit sleep.
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
