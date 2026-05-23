import { Injectable, Logger } from "@nestjs/common";
import { Niche } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SyncStatusService } from "../../services/sync-status.service";
import { AccesstradeClient } from "../crawler/clients/accesstrade.client";

export interface KeywordRadarRefreshResult {
  fetched: number;
  saved: number;
  matched: number;
}

/**
 * Loop 1 phần 2: pull `/v1/offers_informations/keyword_list` → `KeywordTrend`.
 * Compute heuristic match keyword → niche dựa trên word overlap với niche.slug.
 */
@Injectable()
export class KeywordRadarService {
  private readonly logger = new Logger(KeywordRadarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient,
    private readonly syncStatus: SyncStatusService
  ) {}

  async refresh(): Promise<KeywordRadarRefreshResult> {
    return this.syncStatus.wrap("keyword_radar", () => this.refreshInner());
  }

  private async refreshInner(): Promise<KeywordRadarRefreshResult> {
    const batchId = `batch_${Date.now()}`;
    const keywords = await this.accesstrade.fetchKeywordList();
    let saved = 0;
    let matched = 0;

    const niches = await this.prisma.niche.findMany({ where: { status: "ACTIVE" } });

    for (const k of keywords) {
      const merchant = (k.id ?? "").split("-")[0] ?? "unknown";
      const upserted = await this.prisma.keywordTrend.upsert({
        where: { atKeywordId: k.id },
        create: {
          atKeywordId: k.id,
          iconText: k.icon_text,
          merchant,
          totalOffer: k.total_offer,
          syncBatchId: batchId
        },
        update: {
          iconText: k.icon_text,
          totalOffer: k.total_offer,
          fetchedAt: new Date(),
          syncBatchId: batchId
        }
      });
      saved += 1;

      // Clear previous matches for this keyword, recompute.
      await this.prisma.keywordNicheMatch.deleteMany({ where: { keywordTrendId: upserted.id } });

      const match = matchKeywordToNiche(k.icon_text, niches);
      if (match) {
        await this.prisma.keywordNicheMatch.create({
          data: {
            keywordTrendId: upserted.id,
            nicheId: match.nicheId,
            matchScore: match.score,
            matchReason: match.reason
          }
        });
        matched += 1;
      }
    }

    this.logger.log(`keyword_radar fetched=${keywords.length} saved=${saved} matched=${matched}`);
    return { fetched: keywords.length, saved, matched };
  }
}

function removeDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

function matchKeywordToNiche(
  keywordText: string,
  niches: Niche[]
): { nicheId: string; score: number; reason: string } | null {
  const keywordLower = removeDiacritics(keywordText.toLowerCase());
  for (const niche of niches) {
    const slugWords = niche.slug.split("-").filter((w) => w.length >= 3);
    if (slugWords.length === 0) continue;
    const matchCount = slugWords.filter((w) => keywordLower.includes(w)).length;
    if (matchCount >= 2 || (matchCount === 1 && slugWords.length === 1)) {
      return {
        nicheId: niche.id,
        score: matchCount / slugWords.length,
        reason: `slug words match: ${matchCount}/${slugWords.length}`
      };
    }
  }
  return null;
}
