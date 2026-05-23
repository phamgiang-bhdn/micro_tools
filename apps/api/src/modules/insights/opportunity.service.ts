import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface Opportunity {
  nicheSlug: string;
  nicheName: string;
  merchant: string;
  commissionRange: string;
  commissionMax: number;
  hotKeywords: string[];
  productCount: number;
  hasArticle: boolean;
  score: number;
}

/**
 * Combine CommissionRank × KeywordTrend → top opportunities cho widget "Cơ hội tuần".
 * Score: commission cao + product có sẵn + keyword hot + chưa article.
 */
@Injectable()
export class OpportunityService {
  constructor(private readonly prisma: PrismaService) {}

  async getTopOpportunities(limit = 5): Promise<Opportunity[]> {
    const commissionRanks = await this.prisma.commissionRank.findMany({
      orderBy: { maxCommission: "desc" },
      take: 20
    });

    const out: Opportunity[] = [];

    for (const rank of commissionRanks) {
      const niche = await this.findNicheByCategoryName(
        rank.atSubCategoryName ?? rank.atCategoryName ?? rank.merchant
      );
      if (!niche) continue;

      const matchedKeywords = await this.prisma.keywordNicheMatch.findMany({
        where: { nicheId: niche.id },
        include: { keyword: true },
        take: 3,
        orderBy: { keyword: { totalOffer: "desc" } }
      });

      const hasArticle = await this.prisma.article.findFirst({
        where: { nicheId: niche.id, status: "PUBLISHED" },
        select: { id: true }
      });

      const productCount = await this.prisma.product.count({
        where: { nicheId: niche.id, isPublic: true }
      });

      const score =
        rank.maxCommission +
        (matchedKeywords.length > 0 ? 5 : 0) +
        (productCount > 5 ? 3 : productCount * 0.5) -
        (hasArticle ? 10 : 0);

      out.push({
        nicheSlug: niche.slug,
        nicheName: niche.name,
        merchant: rank.merchant,
        commissionRange: `${rank.minCommission}-${rank.maxCommission}%`,
        commissionMax: rank.maxCommission,
        hotKeywords: matchedKeywords.map((m) => m.keyword.iconText),
        productCount,
        hasArticle: Boolean(hasArticle),
        score
      });
    }

    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async findNicheByCategoryName(name: string | null) {
    if (!name) return null;
    const lower = removeDiacritics(name.toLowerCase());
    return this.prisma.niche.findFirst({
      where: {
        OR: [
          { name: { contains: name, mode: "insensitive" } },
          { slug: { contains: lower.replace(/\s+/g, "-") } }
        ]
      }
    });
  }
}

function removeDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}
