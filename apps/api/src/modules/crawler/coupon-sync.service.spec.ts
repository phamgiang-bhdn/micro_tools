import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AccesstradeClient,
  AtCoupon,
  AtKeyword,
  AtMerchant
} from "./clients/accesstrade.client";
import {
  COUPON_SYNC_SLEEP_MS,
  CouponSyncService
} from "./coupon-sync.service";

function makeMerchant(overrides: Partial<AtMerchant> = {}): AtMerchant {
  return {
    id: "555",
    display_name: "Shopee",
    login_name: "shopee",
    logo: "https://cdn/shopee.png",
    total_offer: 10,
    ...overrides
  };
}

function makeKeyword(overrides: Partial<AtKeyword> = {}): AtKeyword {
  return {
    id: "shopee-1814",
    icon_text: "ShopeePay",
    total_offer: 5,
    ...overrides
  };
}

function makeCoupon(overrides: Partial<AtCoupon> = {}): AtCoupon {
  return {
    id: "coup-1",
    name: "Giảm 20%",
    content: "<p>HTML mô tả</p>",
    image: "https://cdn/img.png",
    link: "https://aff/coup-1",
    prod_link: "https://shopee.vn/x",
    merchant: "shopee",
    domain: "shopee.vn",
    start_time: "2026-05-16T00:00:00Z",
    end_time: "2026-06-16T00:00:00Z",
    banners: [],
    coupons: [],
    discount_percentage: 20,
    discount_value: 50000,
    ...overrides
  };
}

interface CouponRecord {
  id: string;
  atCouponId: string | null;
  code: string;
  description: string | null;
  contentHtml: string | null;
  isActive: boolean;
  campaignId: string | null;
  merchantSlug: string | null;
}

interface CampaignRecord {
  id: string;
  merchantName: string | null;
  status: string;
}

class FakePrisma {
  coupons = new Map<string, CouponRecord>();
  campaigns: CampaignRecord[] = [];
  private seq = 0;

  campaign = {
    findMany: jest.fn(async ({ where }: { where?: { status?: string } } = {}) => {
      return this.campaigns.filter(
        (c) => (where?.status ? c.status === where.status : true) && c.merchantName
      );
    })
  };

  coupon = {
    findUnique: jest.fn(async ({ where }: { where: { atCouponId?: string } }) => {
      if (where.atCouponId) {
        for (const row of this.coupons.values()) {
          if (row.atCouponId === where.atCouponId) return row;
        }
      }
      return null;
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      this.seq += 1;
      const row: CouponRecord = {
        id: `c-${this.seq}`,
        atCouponId: (data.atCouponId as string) ?? null,
        code: data.code as string,
        description: (data.description as string) ?? null,
        contentHtml: (data.contentHtml as string) ?? null,
        isActive: data.isActive as boolean,
        campaignId: (data.campaignId as string) ?? null,
        merchantSlug: (data.merchantSlug as string) ?? null
      };
      this.coupons.set(row.id, row);
      return row;
    }),
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = this.coupons.get(where.id);
        if (!row) throw new Error("not found");
        if (data.contentHtml !== undefined) row.contentHtml = data.contentHtml as string;
        if (data.description !== undefined) row.description = (data.description as string) ?? null;
        // Critical regression: update phải KHÔNG được đụng isActive.
        if (data.isActive !== undefined) row.isActive = data.isActive as boolean;
        return row;
      }
    )
  };
}

class FakeAccesstradeClient {
  merchants: AtMerchant[] = [];
  keywordsByMerchant = new Map<string, AtKeyword[]>();
  couponsByKeyword = new Map<string, AtCoupon[]>();

  fetchMerchantsWithCoupons = jest.fn(async () => this.merchants);
  fetchKeywordsByMerchant = jest.fn(
    async (mid: string) => this.keywordsByMerchant.get(mid) ?? []
  );
  fetchCouponsByKeyword = jest.fn(
    async (kid: string) => this.couponsByKeyword.get(kid) ?? []
  );
}

class TestableCouponSyncService extends CouponSyncService {
  public sleepCalls: number[] = [];
  protected sleep(ms: number): Promise<void> {
    this.sleepCalls.push(ms);
    return Promise.resolve();
  }
}

async function buildService(): Promise<{
  service: TestableCouponSyncService;
  prisma: FakePrisma;
  accesstrade: FakeAccesstradeClient;
}> {
  const prisma = new FakePrisma();
  const accesstrade = new FakeAccesstradeClient();
  const moduleRef = await Test.createTestingModule({
    providers: [
      TestableCouponSyncService,
      { provide: PrismaService, useValue: prisma },
      { provide: AccesstradeClient, useValue: accesstrade }
    ]
  }).compile();
  const service = moduleRef.get(TestableCouponSyncService);
  return { service, prisma, accesstrade };
}

describe(CouponSyncService.name, () => {
  describe("syncFromAccesstrade", () => {
    it("cross-references AT merchants with approved campaigns (case-insensitive)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [
        { id: "camp-1", merchantName: "Shopee", status: "APPROVED" },
        { id: "camp-2", merchantName: "tiki", status: "APPROVED" }
      ];
      accesstrade.merchants = [
        makeMerchant({ id: "m1", login_name: "shopee" }),
        makeMerchant({ id: "m2", login_name: "lazada" }),
        makeMerchant({ id: "m3", login_name: "TIKI" })
      ];
      accesstrade.keywordsByMerchant.set("m1", [makeKeyword({ id: "k-shopee" })]);
      accesstrade.keywordsByMerchant.set("m3", [makeKeyword({ id: "k-tiki" })]);
      accesstrade.couponsByKeyword.set("k-shopee", [makeCoupon({ id: "cs-1" })]);
      accesstrade.couponsByKeyword.set("k-tiki", [makeCoupon({ id: "ct-1" })]);

      const res = await service.syncFromAccesstrade();

      expect(accesstrade.fetchKeywordsByMerchant).toHaveBeenCalledTimes(2);
      expect(accesstrade.fetchKeywordsByMerchant).toHaveBeenCalledWith("m1");
      expect(accesstrade.fetchKeywordsByMerchant).toHaveBeenCalledWith("m3");
      expect(accesstrade.fetchKeywordsByMerchant).not.toHaveBeenCalledWith("m2");
      expect(res.fetched).toBe(2);
      expect(res.created).toBe(2);
    });

    it("skips entirely when no merchant matched (no keyword fetches, no DB writes)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [
        { id: "camp-1", merchantName: "tiki", status: "APPROVED" }
      ];
      accesstrade.merchants = [makeMerchant({ id: "m1", login_name: "shopee" })];

      const res = await service.syncFromAccesstrade();

      expect(accesstrade.fetchKeywordsByMerchant).not.toHaveBeenCalled();
      expect(prisma.coupons.size).toBe(0);
      expect(res).toEqual({ fetched: 0, created: 0, updated: 0, skipped: 0 });
    });

    it("HITL gate: newly synced coupons get isActive=false", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [{ id: "camp-1", merchantName: "shopee", status: "APPROVED" }];
      accesstrade.merchants = [makeMerchant({ id: "m1" })];
      accesstrade.keywordsByMerchant.set("m1", [makeKeyword()]);
      accesstrade.couponsByKeyword.set("shopee-1814", [makeCoupon({ id: "new-coupon" })]);

      await service.syncFromAccesstrade();

      const row = [...prisma.coupons.values()][0];
      expect(row.isActive).toBe(false);
    });

    it("sanitizes contentHtml before persisting (strips <script>)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [{ id: "camp-1", merchantName: "shopee", status: "APPROVED" }];
      accesstrade.merchants = [makeMerchant({ id: "m1" })];
      accesstrade.keywordsByMerchant.set("m1", [makeKeyword()]);
      accesstrade.couponsByKeyword.set("shopee-1814", [
        makeCoupon({ id: "evil", content: "<p>OK</p><script>alert(1)</script>" })
      ]);

      await service.syncFromAccesstrade();

      const row = [...prisma.coupons.values()][0];
      expect(row.contentHtml).toContain("<p>OK</p>");
      expect(row.contentHtml?.toLowerCase()).not.toContain("<script");
    });

    it("is idempotent — second run UPDATES, doesn't duplicate row", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [{ id: "camp-1", merchantName: "shopee", status: "APPROVED" }];
      accesstrade.merchants = [makeMerchant({ id: "m1" })];
      accesstrade.keywordsByMerchant.set("m1", [makeKeyword()]);
      accesstrade.couponsByKeyword.set("shopee-1814", [makeCoupon({ id: "stable" })]);

      const first = await service.syncFromAccesstrade();
      const second = await service.syncFromAccesstrade();

      expect(first).toMatchObject({ created: 1, updated: 0 });
      expect(second).toMatchObject({ created: 0, updated: 1 });
      expect(prisma.coupons.size).toBe(1);
    });

    it("rate-limits with 7s sleep between every keyword + merchant fetch", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [{ id: "camp-1", merchantName: "shopee", status: "APPROVED" }];
      accesstrade.merchants = [makeMerchant({ id: "m1" })];
      accesstrade.keywordsByMerchant.set("m1", [
        makeKeyword({ id: "k1" }),
        makeKeyword({ id: "k2" })
      ]);
      accesstrade.couponsByKeyword.set("k1", [makeCoupon({ id: "c1" })]);
      accesstrade.couponsByKeyword.set("k2", [makeCoupon({ id: "c2" })]);

      await service.syncFromAccesstrade();

      // 1 sleep after fetchKeywords + 2 sleeps after each fetchCoupons = 3
      expect(service.sleepCalls.every((ms) => ms === COUPON_SYNC_SLEEP_MS)).toBe(true);
      expect(service.sleepCalls.length).toBe(3);
    });

    it("counts coupons missing id as skipped, does not crash", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [{ id: "camp-1", merchantName: "shopee", status: "APPROVED" }];
      accesstrade.merchants = [makeMerchant({ id: "m1" })];
      accesstrade.keywordsByMerchant.set("m1", [makeKeyword()]);
      accesstrade.couponsByKeyword.set("shopee-1814", [
        makeCoupon({ id: "" }),
        makeCoupon({ id: "good" })
      ]);

      const res = await service.syncFromAccesstrade();

      expect(res).toMatchObject({ fetched: 2, created: 1, skipped: 1 });
    });

    it("caps at COUPON_SYNC_KEYWORDS_PER_MERCHANT keywords per merchant", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [{ id: "camp-1", merchantName: "shopee", status: "APPROVED" }];
      accesstrade.merchants = [makeMerchant({ id: "m1" })];
      const manyKw = Array.from({ length: 12 }, (_, i) => makeKeyword({ id: `k-${i}` }));
      accesstrade.keywordsByMerchant.set("m1", manyKw);
      for (const kw of manyKw) {
        accesstrade.couponsByKeyword.set(kw.id, []);
      }

      await service.syncFromAccesstrade();

      // 5 keyword fetches (cap) + 1 keyword-list fetch sleep = 6 sleep total
      expect(accesstrade.fetchCouponsByKeyword).toHaveBeenCalledTimes(5);
    });

    it("passes Decimal-coerced numerics correctly", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.campaigns = [{ id: "camp-1", merchantName: "shopee", status: "APPROVED" }];
      accesstrade.merchants = [makeMerchant({ id: "m1" })];
      accesstrade.keywordsByMerchant.set("m1", [makeKeyword()]);
      accesstrade.couponsByKeyword.set("shopee-1814", [
        makeCoupon({ id: "c", coin_cap: 1500000, coin_percentage: 1.5, percentage_used: 75 })
      ]);

      await service.syncFromAccesstrade();
      const createArgs = prisma.coupon.create.mock.calls[0][0].data as Record<string, unknown>;

      expect(createArgs.coinCap).toBeInstanceOf(Prisma.Decimal);
      expect((createArgs.coinCap as Prisma.Decimal).toString()).toBe("1500000");
      expect((createArgs.coinPercentage as Prisma.Decimal).toString()).toBe("1.5");
      expect((createArgs.percentageUsed as Prisma.Decimal).toString()).toBe("75");
    });
  });
});
