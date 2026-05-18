import { Test } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient, FetchProductsOpts } from "./clients/accesstrade.client";
import { LazadaAffiliateClient } from "./clients/lazada.client";
import { ShopeeAffiliateClient } from "./clients/shopee.client";
import { TiktokAffiliateClient } from "./clients/tiktok.client";
import { CrawlerService, offerPassesFilter, rulesToFetchOpts } from "./crawler.service";
import * as nicheInference from "./niche-inference.util";
import { DEFAULT_FILTER_RULES, FilterRules } from "./dto/filter-rules.dto";
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
    nicheSlug: "",
    ...overrides
  };
}

interface AssignmentRow {
  id: string;
  priority: number;
  filterRules: unknown;
  niche: { id: string; slug: string };
  campaign: { id: string; name: string; merchantName: string };
}

class FakePrisma {
  assignments: AssignmentRow[] = [];
  lastCrawlerLogUpdate: Record<string, unknown> | null = null;

  campaignNiche = {
    findMany: jest.fn(async () => this.assignments)
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
    it("loops per assignment, 1 fetch per assignment with merchantSlug pushed down", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.assignments = [
        {
          id: "a-tivi",
          priority: 100,
          filterRules: null,
          niche: { id: "cat-tivi", slug: "tivi" },
          campaign: { id: "c-1", name: "Lazada", merchantName: "lazada_kol" }
        },
        {
          id: "a-may-loc",
          priority: 100,
          filterRules: null,
          niche: { id: "cat-loc", slug: "may-loc-khong-khi" },
          campaign: { id: "c-1", name: "Lazada", merchantName: "lazada_kol" }
        }
      ];
      accesstrade.fetchProducts.mockResolvedValue([]);

      await service.runFullCycle("test");

      expect(accesstrade.fetchProducts).toHaveBeenCalledTimes(2);
      expect(accesstrade.fetchProducts).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ campaign: "lazada_kol", limit: 100, page: 1 })
      );
    });

    it("pushes filterRules to AT params (minDiscount, price, sale, discountAmount, domain, lookback)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.assignments = [
        {
          id: "a-1",
          priority: 100,
          filterRules: {
            minDiscountPercent: 20,
            maxDiscountPercent: 70,
            priceMin: 1000000,
            priceMax: 50000000,
            salePriceMin: 500000,
            salePriceMax: 40000000,
            discountAmountMin: 100000,
            discountAmountMax: 5000000,
            updateLookbackDays: 7,
            domains: ["lazada.vn"]
          },
          niche: { id: "cat-tivi", slug: "tivi" },
          campaign: { id: "c-1", name: "Lazada", merchantName: "lazada_kol" }
        }
      ];
      accesstrade.fetchProducts.mockResolvedValue([]);

      await service.runFullCycle("test");

      const call = accesstrade.fetchProducts.mock.calls[0][0];
      expect(call).toMatchObject({
        campaign: "lazada_kol",
        limit: 100,
        page: 1,
        discountRateFrom: 20,
        discountRateTo: 70,
        statusDiscount: 1, // tự bật vì minDiscount > 0
        priceFrom: 1000000,
        priceTo: 50000000,
        salePriceFrom: 500000,
        salePriceTo: 40000000,
        discountAmountFrom: 100000,
        discountAmountTo: 5000000,
        domain: "lazada.vn"
      });
      // updateFrom format DD-MM-YYYY
      expect(call?.updateFrom).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    });

    it("does NOT push domain when multiple domains (AT only accepts 1)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.assignments = [
        {
          id: "a-1",
          priority: 100,
          filterRules: { domains: ["shopee.vn", "lazada.vn"] },
          niche: { id: "cat-1", slug: "tivi" },
          campaign: { id: "c-1", name: "X", merchantName: "lazada_kol" }
        }
      ];
      accesstrade.fetchProducts.mockResolvedValue([]);

      await service.runFullCycle("test");

      const call = accesstrade.fetchProducts.mock.calls[0][0];
      expect(call?.domain).toBeUndefined();
    });

    it("routes every fetched offer directly to assignment's niche (no name match)", async () => {
      const { service, prisma, accesstrade, importer } = await buildService();
      prisma.assignments = [
        {
          id: "a-tivi",
          priority: 100,
          filterRules: null,
          niche: { id: "cat-tivi", slug: "tivi" },
          campaign: { id: "c-1", name: "Lazada", merchantName: "lazada_kol" }
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-1", campaign: "anything" }),
        makeOffer({ externalId: "p-2", campaign: undefined }) // không cần campaign trong response
      ]);

      await service.runFullCycle("test");

      const offers = importer.upsertOffers.mock.calls[0][0];
      expect(offers).toHaveLength(2);
      expect(offers.every((o) => o.nicheSlug === "tivi")).toBe(true);
      expect(offers.every((o) => o.campaignDbId === "c-1")).toBe(true);
    });

    it("falls back to DEFAULT_FILTER_RULES when assignment.filterRules is invalid", async () => {
      const { service, prisma, accesstrade, importer } = await buildService();
      prisma.assignments = [
        {
          id: "a-bad",
          priority: 100,
          filterRules: { garbageField: true },
          niche: { id: "cat-1", slug: "tivi" },
          campaign: { id: "c-1", name: "Lazada", merchantName: "lazada_kol" }
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-1", discountPercent: 10 })
      ]);

      await service.runFullCycle("test");

      const offers = importer.upsertOffers.mock.calls[0][0];
      expect(offers).toHaveLength(1);
    });

    it("sets nicheSlug from assignment, not from inferNicheSlug", async () => {
      const { service, prisma, accesstrade, importer } = await buildService();
      const inferSpy = jest.spyOn(nicheInference, "inferNicheSlug");
      prisma.assignments = [
        {
          id: "a-1",
          priority: 100,
          filterRules: {},
          niche: { id: "cat-1", slug: "may-loc-khong-khi" },
          campaign: { id: "c-1", name: "X", merchantName: "lazada_kol" }
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-1", nicheSlug: "" })
      ]);

      await service.runFullCycle("test");

      expect(inferSpy).not.toHaveBeenCalled();
      const offers = importer.upsertOffers.mock.calls[0][0];
      expect(offers[0].nicheSlug).toBe("may-loc-khong-khi");
      expect(offers[0].campaignDbId).toBe("c-1");
      inferSpy.mockRestore();
    });

    it("returns assignments breakdown in CycleResult", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.assignments = [
        {
          id: "a-tivi",
          priority: 100,
          filterRules: null,
          niche: { id: "cat-tivi", slug: "tivi" },
          campaign: { id: "c-1", name: "Lazada", merchantName: "lazada_kol" }
        }
      ];
      accesstrade.fetchProducts.mockResolvedValueOnce([
        makeOffer({ externalId: "p-1" }),
        makeOffer({ externalId: "p-2" })
      ]);

      const result = await service.runFullCycle("test");

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0]).toMatchObject({
        assignmentId: "a-tivi",
        campaignId: "c-1",
        merchantSlug: "lazada_kol",
        nicheSlug: "tivi",
        fetched: 2,
        routed: 2,
        failedFilter: 0
      });
    });
  });

  describe("rulesToFetchOpts", () => {
    it("returns empty when rules are empty", () => {
      expect(rulesToFetchOpts({})).toEqual({});
    });

    it("ignores minDiscountPercent=0 (no push)", () => {
      const opts = rulesToFetchOpts({ minDiscountPercent: 0 });
      expect(opts.discountRateFrom).toBeUndefined();
      expect(opts.statusDiscount).toBeUndefined();
    });

    it("auto-sets statusDiscount=1 when minDiscountPercent > 0", () => {
      const opts = rulesToFetchOpts({ minDiscountPercent: 20 });
      expect(opts.discountRateFrom).toBe(20);
      expect(opts.statusDiscount).toBe(1);
    });

    it("respects explicit status_discount=0 override", () => {
      const opts = rulesToFetchOpts({ status_discount: 0 });
      expect(opts.statusDiscount).toBe(0);
    });

    it("skips domain when multiple or zero", () => {
      expect(rulesToFetchOpts({ domains: [] }).domain).toBeUndefined();
      expect(rulesToFetchOpts({ domains: ["a", "b"] }).domain).toBeUndefined();
      expect(rulesToFetchOpts({ domains: ["lazada.vn"] }).domain).toBe("lazada.vn");
    });

    it("converts updateLookbackDays to DD-MM-YYYY", () => {
      const opts = rulesToFetchOpts({ updateLookbackDays: 7 });
      expect(opts.updateFrom).toMatch(/^\d{2}-\d{2}-\d{4}$/);
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
      expect(offerPassesFilter(offer, { priceMin: 1000 } as FilterRules)).toBe(false);
      expect(offerPassesFilter(offer, { priceMax: 100 } as FilterRules)).toBe(false);
      expect(offerPassesFilter(offer, { priceMin: 100, priceMax: 1000 } as FilterRules)).toBe(true);
    });

    it("respects domains whitelist", () => {
      const a = makeOffer({ affiliateUrl: "https://shopee.vn/x" });
      const b = makeOffer({ affiliateUrl: "https://lazada.vn/y" });
      expect(offerPassesFilter(a, { domains: ["shopee.vn"] })).toBe(true);
      expect(offerPassesFilter(b, { domains: ["shopee.vn"] })).toBe(false);
    });
  });
});
