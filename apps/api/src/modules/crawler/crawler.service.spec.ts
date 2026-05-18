import { Test } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient, FetchProductsOpts } from "./clients/accesstrade.client";
import { LazadaAffiliateClient } from "./clients/lazada.client";
import { ShopeeAffiliateClient } from "./clients/shopee.client";
import { TiktokAffiliateClient } from "./clients/tiktok.client";
import { CrawlerService, offerPassesFilter } from "./crawler.service";
import * as categoryInference from "./category-inference.util";
import { DEFAULT_FILTER_RULES } from "./dto/filter-rules.dto";
import { NormalizedOffer } from "./dto/normalized-offer.dto";
import { EnrichmentService } from "./enrichment.service";
import { ImportResult, ImportService } from "./import.service";

function makeOffer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    source: "accesstrade",
    externalId: "p-1",
    name: "Sản phẩm",
    affiliateUrl: "https://shopee.vn/x",
    currency: "VND",
    categorySlug: "",
    ...overrides
  };
}

interface AssignmentRow {
  id: string;
  priority: number;
  filterRules: unknown;
  category: { id: string; slug: string };
}

interface CampaignRow {
  id: string;
  atCampaignId: string | null;
  name: string;
  merchantName: string | null;
  assignments: AssignmentRow[];
}

class FakePrisma {
  campaigns: CampaignRow[] = [];
  lastCrawlerLogUpdate: Record<string, unknown> | null = null;

  campaign = {
    findMany: jest.fn(async () =>
      this.campaigns.filter((c) => c.atCampaignId !== null && c.assignments.length > 0)
    )
  };

  crawlerLog = {
    create: jest.fn(async () => ({ id: "log-1" })),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      this.lastCrawlerLogUpdate = data;
      return data;
    })
  };
}

class FakeAccesstrade {
  fetchProducts = jest.fn<Promise<NormalizedOffer[]>, [FetchProductsOpts?]>(async () => []);
}

class FakeEnrichment {
  enrich = jest.fn(async (offer: NormalizedOffer) => offer);
}

class FakeImporter {
  upsertOffers = jest.fn<Promise<ImportResult>, [NormalizedOffer[]]>(
    async () => ({ created: 0, updated: 0, skipped: 0 })
  );
}

async function buildService(): Promise<{
  service: CrawlerService;
  prisma: FakePrisma;
  accesstrade: FakeAccesstrade;
  importer: FakeImporter;
  enrichment: FakeEnrichment;
}> {
  const prisma = new FakePrisma();
  const accesstrade = new FakeAccesstrade();
  const importer = new FakeImporter();
  const enrichment = new FakeEnrichment();
  const moduleRef = await Test.createTestingModule({
    providers: [
      CrawlerService,
      { provide: AccesstradeClient, useValue: accesstrade },
      { provide: ShopeeAffiliateClient, useValue: {} },
      { provide: TiktokAffiliateClient, useValue: {} },
      { provide: LazadaAffiliateClient, useValue: {} },
      { provide: EnrichmentService, useValue: enrichment },
      { provide: ImportService, useValue: importer },
      { provide: PrismaService, useValue: prisma }
    ]
  }).compile();
  const service = moduleRef.get(CrawlerService);
  return { service, prisma, accesstrade, importer, enrichment };
}

describe(CrawlerService.name, () => {
  describe("runFullCycle", () => {
    it("only pulls eligible campaigns (APPROVED + atCampaignId + ≥1 assignment)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [
        {
          id: "c-1",
          atCampaignId: "at-1",
          name: "Shopee",
          merchantName: "Shopee",
          assignments: [
            {
              id: "a-1",
              priority: 100,
              filterRules: null,
              category: { id: "cat-1", slug: "robot-hut-bui-lau-nha" }
            }
          ]
        },
        {
          id: "c-2",
          atCampaignId: "at-2",
          name: "Lazada",
          merchantName: "Lazada",
          assignments: [] // no assignment — should be filtered out by findMany WHERE
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([makeOffer({ externalId: "p-1" })]);

      await service.runFullCycle("test");

      expect(accesstrade.fetchProducts).toHaveBeenCalledTimes(1);
      expect(accesstrade.fetchProducts).toHaveBeenCalledWith(
        expect.objectContaining({ campaign: "at-1" })
      );
    });

    it("routes offer by first-match-wins (priority asc)", async () => {
      const { service, prisma, accesstrade, importer } = await buildService();
      prisma.campaigns = [
        {
          id: "c-1",
          atCampaignId: "at-1",
          name: "Shopee",
          merchantName: "Shopee",
          assignments: [
            // priority 1 = niche robot, chỉ match domain shopee.vn
            {
              id: "a-robot",
              priority: 1,
              filterRules: { domains: ["shopee.vn"] },
              category: { id: "cat-robot", slug: "robot-hut-bui-lau-nha" }
            },
            // priority 100 = fallback, match mọi domain
            {
              id: "a-default",
              priority: 100,
              filterRules: {},
              category: { id: "cat-default", slug: "may-loc-khong-khi" }
            }
          ]
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-shopee", affiliateUrl: "https://shopee.vn/a" }),
        makeOffer({ externalId: "p-lazada", affiliateUrl: "https://lazada.vn/b" })
      ]);

      await service.runFullCycle("test");

      const offers = importer.upsertOffers.mock.calls[0][0];
      const byId = new Map(offers.map((o) => [o.externalId, o.categorySlug]));
      expect(byId.get("p-shopee")).toBe("robot-hut-bui-lau-nha");
      expect(byId.get("p-lazada")).toBe("may-loc-khong-khi");
    });

    it("skips offers when no assignment passes filter", async () => {
      const { service, prisma, accesstrade, importer } = await buildService();
      prisma.campaigns = [
        {
          id: "c-1",
          atCampaignId: "at-1",
          name: "Shopee",
          merchantName: "Shopee",
          assignments: [
            {
              id: "a-strict",
              priority: 100,
              filterRules: { domains: ["shopee.vn"] },
              category: { id: "cat-1", slug: "robot-hut-bui-lau-nha" }
            }
          ]
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-1", affiliateUrl: "https://lazada.vn/x" })
      ]);

      await service.runFullCycle("test");

      const offers = importer.upsertOffers.mock.calls[0][0];
      expect(offers).toHaveLength(0);
    });

    it("falls back to DEFAULT_FILTER_RULES when assignment.filterRules is invalid", async () => {
      const { service, prisma, accesstrade, importer } = await buildService();
      prisma.campaigns = [
        {
          id: "c-1",
          atCampaignId: "at-1",
          name: "Shopee",
          merchantName: "Shopee",
          assignments: [
            {
              id: "a-bad",
              priority: 100,
              filterRules: { minDiscountPercent: 9999, garbage: "yes" },
              category: { id: "cat-1", slug: "robot-hut-bui-lau-nha" }
            }
          ]
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-1", discountPercent: 10 })
      ]);

      await service.runFullCycle("test");

      const offers = importer.upsertOffers.mock.calls[0][0];
      // DEFAULT_FILTER_RULES.minDiscountPercent = 0 → offer pass
      expect(offers).toHaveLength(1);
    });

    it("sets categorySlug from matched assignment, not from inferCategorySlug", async () => {
      const { service, prisma, accesstrade, importer } = await buildService();
      const inferSpy = jest.spyOn(categoryInference, "inferCategorySlug");
      prisma.campaigns = [
        {
          id: "c-1",
          atCampaignId: "at-1",
          name: "Shopee",
          merchantName: "Shopee",
          assignments: [
            {
              id: "a-1",
              priority: 100,
              filterRules: {},
              category: { id: "cat-1", slug: "may-loc-khong-khi" }
            }
          ]
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-1", categorySlug: "" })
      ]);

      await service.runFullCycle("test");

      expect(inferSpy).not.toHaveBeenCalled();
      const offers = importer.upsertOffers.mock.calls[0][0];
      expect(offers).toHaveLength(1);
      expect(offers[0].categorySlug).toBe("may-loc-khong-khi");
      expect(offers[0].campaignDbId).toBe("c-1");
      inferSpy.mockRestore();
    });
  });

  describe("offerPassesFilter", () => {
    it("DEFAULT_FILTER_RULES allows any offer", () => {
      expect(offerPassesFilter(makeOffer(), DEFAULT_FILTER_RULES)).toBe(true);
    });

    it("rejects offer without discountPercent when minDiscountPercent > 0", () => {
      expect(offerPassesFilter(makeOffer(), { minDiscountPercent: 20 })).toBe(false);
    });

    it("respects price range", () => {
      const offer = makeOffer({ price: 500 });
      expect(offerPassesFilter(offer, { priceMin: 1000 })).toBe(false);
      expect(offerPassesFilter(offer, { priceMax: 100 })).toBe(false);
      expect(offerPassesFilter(offer, { priceMin: 100, priceMax: 1000 })).toBe(true);
    });

    it("respects domains whitelist", () => {
      const a = makeOffer({ affiliateUrl: "https://shopee.vn/x" });
      const b = makeOffer({ affiliateUrl: "https://lazada.vn/y" });
      expect(offerPassesFilter(a, { domains: ["shopee.vn"] })).toBe(true);
      expect(offerPassesFilter(b, { domains: ["shopee.vn"] })).toBe(false);
    });
  });
});
