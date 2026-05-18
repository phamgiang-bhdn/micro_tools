import { Test } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CampaignSyncService } from "./campaign-sync.service";
import { AccesstradeCampaign, AccesstradeClient } from "./clients/accesstrade.client";

function makeCampaign(overrides: Partial<AccesstradeCampaign> = {}): AccesstradeCampaign {
  return {
    id: "555",
    name: "Shopee CPS",
    merchant: "Shopee",
    approval: "successful",
    status: 1,
    logo: "https://cdn/shopee.png",
    url: "https://shopee.vn",
    scope: "public",
    cookie_duration: 86400,
    category: "Marketplace",
    sub_category: "E-commerce",
    start_time: "2026-01-01T00:00:00Z",
    end_time: null,
    ...overrides
  };
}

interface CampaignRecord {
  id: string;
  atCampaignId: string | null;
  name: string;
  notes: string | null;
}

class FakePrisma {
  rows = new Map<string, CampaignRecord>();

  campaign = {
    findUnique: jest.fn(async ({ where }: { where: { atCampaignId?: string; id?: string } }) => {
      if (where.atCampaignId) {
        for (const row of this.rows.values()) {
          if (row.atCampaignId === where.atCampaignId) return row;
        }
      }
      if (where.id) return this.rows.get(where.id) ?? null;
      return null;
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const id = `row-${this.rows.size + 1}`;
      const row: CampaignRecord = {
        id,
        atCampaignId: (data.atCampaignId as string) ?? null,
        name: data.name as string,
        notes: null
      };
      this.rows.set(id, row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = this.rows.get(where.id);
      if (!row) throw new Error(`not found: ${where.id}`);
      // Apply only the fields the service actually writes; admin-managed fields stay untouched.
      if (data.name !== undefined) row.name = data.name as string;
      return row;
    })
  };

  seed(row: CampaignRecord): void {
    this.rows.set(row.id, row);
  }
}

class FakeAccesstradeClient {
  pages: AccesstradeCampaign[][] = [];
  fetchCampaigns = jest.fn(
    async ({ page }: { approval?: string; page?: number; limit?: number } = {}) => {
      const idx = (page ?? 1) - 1;
      return this.pages[idx] ?? [];
    }
  );

  setPages(pages: AccesstradeCampaign[][]): void {
    this.pages = pages;
  }
}

async function buildService(): Promise<{
  service: CampaignSyncService;
  prisma: FakePrisma;
  accesstrade: FakeAccesstradeClient;
}> {
  const prisma = new FakePrisma();
  const accesstrade = new FakeAccesstradeClient();
  const moduleRef = await Test.createTestingModule({
    providers: [
      CampaignSyncService,
      { provide: PrismaService, useValue: prisma },
      { provide: AccesstradeClient, useValue: accesstrade }
    ]
  }).compile();
  const service = moduleRef.get(CampaignSyncService);
  return { service, prisma, accesstrade };
}

describe(CampaignSyncService.name, () => {
  describe("syncFromAccesstrade", () => {
    it("creates rows on first run", async () => {
      const { service, accesstrade } = await buildService();
      accesstrade.setPages([[makeCampaign({ id: "1" }), makeCampaign({ id: "2" })]]);

      const res = await service.syncFromAccesstrade();

      expect(res).toEqual({ fetched: 2, created: 2, updated: 0, skipped: 0 });
    });

    it("is idempotent — second run only updates", async () => {
      const { service, accesstrade } = await buildService();
      accesstrade.setPages([[makeCampaign({ id: "1" }), makeCampaign({ id: "2" })]]);

      await service.syncFromAccesstrade();
      const res = await service.syncFromAccesstrade();

      expect(res).toEqual({ fetched: 2, created: 0, updated: 2, skipped: 0 });
    });

    it("does not overwrite admin-managed fields (notes, status)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      prisma.seed({
        id: "row-existing",
        atCampaignId: "999",
        name: "old name",
        notes: "manual admin note"
      });
      accesstrade.setPages([[makeCampaign({ id: "999", name: "new name from AT" })]]);

      await service.syncFromAccesstrade();
      const row = prisma.rows.get("row-existing");

      expect(row?.name).toBe("new name from AT");
      expect(row?.notes).toBe("manual admin note");
      // Service must not pass admin-managed keys in update payload.
      const updateArgs = prisma.campaign.update.mock.calls.at(-1)?.[0]?.data ?? {};
      expect(updateArgs).not.toHaveProperty("notes");
      expect(updateArgs).not.toHaveProperty("status");
    });

    it("skips items missing id or name", async () => {
      const { service, accesstrade } = await buildService();
      accesstrade.setPages([
        [
          makeCampaign({ id: "1" }),
          makeCampaign({ id: "" }),
          makeCampaign({ id: "2", name: "" })
        ]
      ]);

      const res = await service.syncFromAccesstrade();

      expect(res).toEqual({ fetched: 3, created: 1, updated: 0, skipped: 2 });
    });

    it("stops paginating when batch < PAGE_SIZE", async () => {
      const { service, accesstrade } = await buildService();
      const full = Array.from({ length: 50 }, (_, i) => makeCampaign({ id: `a-${i}` }));
      const fullB = Array.from({ length: 50 }, (_, i) => makeCampaign({ id: `b-${i}` }));
      const partial = Array.from({ length: 12 }, (_, i) => makeCampaign({ id: `c-${i}` }));
      accesstrade.setPages([full, fullB, partial]);

      const res = await service.syncFromAccesstrade();

      expect(res.fetched).toBe(112);
      expect(accesstrade.fetchCampaigns).toHaveBeenCalledTimes(3);
    });
  });
});
