import { Injectable, Logger } from "@nestjs/common";
import { AffiliateNetwork, CampaignStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeCampaign, AccesstradeClient } from "./clients/accesstrade.client";

export interface CampaignSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 50;

@Injectable()
export class CampaignSyncService {
  private readonly logger = new Logger(CampaignSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  async syncFromAccesstrade(): Promise<CampaignSyncResult> {
    const all = await this.fetchAllPages();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const c of all) {
      if (!c.id || !c.name) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.campaign.findUnique({
        where: { atCampaignId: c.id }
      });

      const baseFields = {
        atCampaignId: c.id,
        name: c.name,
        merchantName: c.merchant ?? null,
        atCategoryName: c.category ?? null,
        atSubCategory: c.sub_category ?? null,
        atLogo: c.logo ?? null,
        atMerchantUrl: c.url ?? null,
        atScope: c.scope ?? null,
        atCookieDurationSec: c.cookie_duration ?? null,
        atStartTime: c.start_time ? new Date(c.start_time) : null,
        atEndTime: c.end_time ? new Date(c.end_time) : null,
        atRawData: c as unknown as Prisma.InputJsonValue,
        atLastSyncedAt: new Date()
      };

      if (existing) {
        await this.prisma.campaign.update({
          where: { id: existing.id },
          data: baseFields
        });
        updated += 1;
      } else {
        await this.prisma.campaign.create({
          data: {
            ...baseFields,
            network: AffiliateNetwork.ACCESSTRADE,
            externalId: c.id,
            status: c.approval === "successful" ? CampaignStatus.APPROVED : CampaignStatus.APPLIED,
            approvedAt: c.approval === "successful" ? new Date() : null
          }
        });
        created += 1;
      }
    }

    this.logger.log(
      `Sync campaigns: ${created} created, ${updated} updated, ${skipped} skipped, ${all.length} total`
    );
    return { fetched: all.length, created, updated, skipped };
  }

  private async fetchAllPages(): Promise<AccesstradeCampaign[]> {
    const all: AccesstradeCampaign[] = [];
    let page = 1;
    while (page <= MAX_PAGES) {
      const batch = await this.accesstrade.fetchCampaigns({
        approval: "successful",
        page,
        limit: PAGE_SIZE
      });
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page += 1;
    }
    return all;
  }
}
