import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SyncStatusService } from "../../services/sync-status.service";
import { AccesstradeClient } from "../crawler/clients/accesstrade.client";

export interface CommissionRankRefreshResult {
  fetched: number;
  saved: number;
}

const MAX_PAGES = 5;
const PAGE_SIZE = 50;
const SLEEP_BETWEEN_PAGES_MS = 1000;

/**
 * Loop 1: pull `/v1/cashback/campaigns` → save `CommissionRank` rows tagged by batchId.
 * On refresh: purge older batches để chỉ giữ latest snapshot.
 * Wrapped bởi `SyncStatusService` → admin widget biết last-success age.
 */
@Injectable()
export class CommissionRankService {
  private readonly logger = new Logger(CommissionRankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient,
    private readonly syncStatus: SyncStatusService
  ) {}

  async refresh(): Promise<CommissionRankRefreshResult> {
    return this.syncStatus.wrap("commission_rank", () => this.refreshInner());
  }

  private async refreshInner(): Promise<CommissionRankRefreshResult> {
    const batchId = `batch_${Date.now()}`;
    let totalFetched = 0;
    let saved = 0;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const campaigns = await this.accesstrade.fetchCashbackCampaigns({
        page,
        pageSize: PAGE_SIZE,
        sortBy: "max_commission",
        sortOrder: "desc"
      });
      if (campaigns.length === 0) break;
      totalFetched += campaigns.length;

      for (const c of campaigns) {
        await this.prisma.commissionRank.create({
          data: {
            atCampaignId: c.campaign_id,
            campaignName: c.name,
            merchant: c.merchant,
            atCategoryName: c.category_name ?? null,
            atSubCategoryName: c.sub_category ?? null,
            minCommission: c.min_commission,
            maxCommission: c.max_commission,
            commissionType: c.commission_type,
            allCommissions: (c.all_commissions ?? {}) as Prisma.InputJsonValue,
            syncBatchId: batchId
          }
        });
        saved += 1;
      }

      if (campaigns.length < PAGE_SIZE) break;
      await sleep(SLEEP_BETWEEN_PAGES_MS);
    }

    // Purge older batches.
    if (saved > 0) {
      await this.prisma.commissionRank.deleteMany({
        where: { syncBatchId: { not: batchId } }
      });
    }

    this.logger.log(`commission_rank refresh fetched=${totalFetched} saved=${saved} batch=${batchId}`);
    return { fetched: totalFetched, saved };
  }

  getTopOpportunities(limit = 10) {
    return this.prisma.commissionRank.findMany({
      orderBy: { maxCommission: "desc" },
      take: limit
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
