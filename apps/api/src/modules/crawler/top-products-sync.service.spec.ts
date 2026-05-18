import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccesstradeClient, AtTopProduct } from "./clients/accesstrade.client";
import { TopProductsSyncService } from "./top-products-sync.service";

function makeTop(overrides: Partial<AtTopProduct> = {}): AtTopProduct {
  return {
    product_id: "p-1",
    name: "Sản phẩm hot",
    brand: "BrandX",
    image: "https://cdn/img.png",
    link: "https://shop/p-1",
    aff_link: "https://aff/p-1",
    category_name: "Home",
    product_category: "Vacuum",
    price: 5000000,
    discount: 250000,
    merchant: "shopee",
    short_desc: "Mô tả ngắn",
    ...overrides
  };
}

interface SnapshotRow {
  id: string;
  snapshotDate: Date;
  position: number;
  atProductId: string;
  name: string;
  image: string | null;
  affLink: string;
  link: string;
  price: Prisma.Decimal | null;
  discount: Prisma.Decimal | null;
  brand: string | null;
  merchant: string | null;
}

class FakePrisma {
  rows: SnapshotRow[] = [];
  private seq = 0;

  topProductSnapshot = {
    findFirst: jest.fn(
      async (args: {
        where?: { snapshotDate?: Date };
        orderBy?: { snapshotDate?: "asc" | "desc" };
      } = {}) => {
        if (args.where?.snapshotDate) {
          const target = args.where.snapshotDate.getTime();
          return this.rows.find((r) => r.snapshotDate.getTime() === target) ?? null;
        }
        if (args.orderBy?.snapshotDate === "desc") {
          const sorted = [...this.rows].sort(
            (a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime()
          );
          return sorted[0] ?? null;
        }
        return this.rows[0] ?? null;
      }
    ),
    findMany: jest.fn(
      async ({
        where,
        orderBy,
        take
      }: {
        where?: { snapshotDate?: Date };
        orderBy?: { position?: "asc" | "desc" };
        take?: number;
      }) => {
        let out = where?.snapshotDate
          ? this.rows.filter((r) => r.snapshotDate.getTime() === where.snapshotDate!.getTime())
          : this.rows;
        if (orderBy?.position === "asc") {
          out = [...out].sort((a, b) => a.position - b.position);
        }
        if (take) out = out.slice(0, take);
        return out;
      }
    ),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      this.seq += 1;
      const row: SnapshotRow = {
        id: `s-${this.seq}`,
        snapshotDate: data.snapshotDate as Date,
        position: data.position as number,
        atProductId: data.atProductId as string,
        name: data.name as string,
        image: (data.image as string | null) ?? null,
        affLink: data.affLink as string,
        link: data.link as string,
        price: (data.price as Prisma.Decimal | null) ?? null,
        discount: (data.discount as Prisma.Decimal | null) ?? null,
        brand: (data.brand as string | null) ?? null,
        merchant: (data.merchant as string | null) ?? null
      };
      this.rows.push(row);
      return row;
    })
  };
}

class FakeAccesstradeClient {
  result: AtTopProduct[] = [];
  fetchTopProducts = jest.fn(
    async (_opts?: { dateFrom?: Date; dateTo?: Date; merchant?: string }) => this.result
  );
}

async function buildService(): Promise<{
  service: TopProductsSyncService;
  prisma: FakePrisma;
  accesstrade: FakeAccesstradeClient;
}> {
  const prisma = new FakePrisma();
  const accesstrade = new FakeAccesstradeClient();
  const moduleRef = await Test.createTestingModule({
    providers: [
      TopProductsSyncService,
      { provide: PrismaService, useValue: prisma },
      { provide: AccesstradeClient, useValue: accesstrade }
    ]
  }).compile();
  return { service: moduleRef.get(TopProductsSyncService), prisma, accesstrade };
}

describe("AccesstradeClient.toAtDayFormat", () => {
  it("formats DD-MM-YYYY (regression: NOT ISO)", () => {
    expect(AccesstradeClient.toAtDayFormat(new Date("2026-05-16T12:00:00Z"))).toBe("16-05-2026");
    expect(AccesstradeClient.toAtDayFormat(new Date("2026-01-03T12:00:00Z"))).toBe("03-01-2026");
    expect(AccesstradeClient.toAtDayFormat(new Date("2026-12-31T12:00:00Z"))).toBe("31-12-2026");
  });
});

describe(TopProductsSyncService.name, () => {
  describe("syncDailySnapshot", () => {
    it("creates one row per product with position 1..N in returned order", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.result = [
        makeTop({ product_id: "a" }),
        makeTop({ product_id: "b" }),
        makeTop({ product_id: "c" })
      ];

      const res = await service.syncDailySnapshot();

      expect(res.created).toBe(3);
      expect(res.skipped).toBe(false);
      const positions = prisma.rows.map((r) => ({ pos: r.position, id: r.atProductId }));
      expect(positions).toEqual([
        { pos: 1, id: "a" },
        { pos: 2, id: "b" },
        { pos: 3, id: "c" }
      ]);
    });

    it("is idempotent same day — second call returns skipped", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.result = [makeTop({ product_id: "x" })];

      await service.syncDailySnapshot();
      const before = prisma.rows.length;
      const second = await service.syncDailySnapshot();

      expect(second.skipped).toBe(true);
      expect(second.created).toBe(0);
      expect(prisma.rows.length).toBe(before);
    });

    it("stores discount as VND Decimal (not divided as percentage)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.result = [makeTop({ product_id: "p", price: 5000000, discount: 250000 })];

      await service.syncDailySnapshot();
      const row = prisma.rows[0];

      expect(row.discount).toBeInstanceOf(Prisma.Decimal);
      expect(row.discount?.toString()).toBe("250000");
      expect(row.price?.toString()).toBe("5000000");
    });

    it("preserves raw image URL (debug for next/image domain config)", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.result = [
        makeTop({ product_id: "p", image: "https://lzd-img-global.slatic.net/g/p/abc.jpg" })
      ];

      await service.syncDailySnapshot();

      expect(prisma.rows[0].image).toBe("https://lzd-img-global.slatic.net/g/p/abc.jpg");
    });

    it("skips items missing product_id or aff_link", async () => {
      const { service, prisma, accesstrade } = await buildService();
      accesstrade.result = [
        makeTop({ product_id: "ok" }),
        makeTop({ product_id: "" }),
        makeTop({ product_id: "no-link", aff_link: "" })
      ];

      const res = await service.syncDailySnapshot();

      expect(res.created).toBe(1);
      expect(prisma.rows.map((r) => r.atProductId)).toEqual(["ok"]);
    });

    it("calls fetchTopProducts with 7-day lookback window", async () => {
      const { service, accesstrade } = await buildService();
      accesstrade.result = [];

      await service.syncDailySnapshot();

      expect(accesstrade.fetchTopProducts).toHaveBeenCalledTimes(1);
      const args = accesstrade.fetchTopProducts.mock.calls[0][0]!;
      const spanDays = (args.dateTo!.getTime() - args.dateFrom!.getTime()) / (24 * 3600 * 1000);
      expect(spanDays).toBeGreaterThanOrEqual(6.9);
      expect(spanDays).toBeLessThanOrEqual(7.1);
    });
  });

  describe("getLatestSnapshot", () => {
    it("returns only rows from the most recent snapshotDate, ordered by position", async () => {
      const { service, prisma } = await buildService();
      const day1 = new Date("2026-05-15T00:00:00Z");
      const day2 = new Date("2026-05-16T00:00:00Z");
      prisma.rows = [
        rowOf({ snapshotDate: day1, position: 1, atProductId: "old-1" }),
        rowOf({ snapshotDate: day1, position: 2, atProductId: "old-2" }),
        rowOf({ snapshotDate: day2, position: 2, atProductId: "new-2" }),
        rowOf({ snapshotDate: day2, position: 1, atProductId: "new-1" })
      ];

      const out = await service.getLatestSnapshot(12);

      expect(out.map((r) => r.atProductId)).toEqual(["new-1", "new-2"]);
      expect(out.every((r) => r.snapshotDate.getTime() === day2.getTime())).toBe(true);
    });

    it("respects limit (capped at 50)", async () => {
      const { service, prisma } = await buildService();
      const day = new Date("2026-05-16T00:00:00Z");
      prisma.rows = Array.from({ length: 60 }, (_, i) =>
        rowOf({ snapshotDate: day, position: i + 1, atProductId: `p-${i}` })
      );

      const out = await service.getLatestSnapshot(80);

      expect(out.length).toBe(50);
    });

    it("returns empty array when no snapshot exists", async () => {
      const { service } = await buildService();
      const out = await service.getLatestSnapshot();
      expect(out).toEqual([]);
    });
  });
});

function rowOf(partial: Partial<SnapshotRow> & { snapshotDate: Date; position: number; atProductId: string }): SnapshotRow {
  return {
    id: `r-${Math.random()}`,
    name: partial.name ?? "x",
    image: partial.image ?? null,
    affLink: partial.affLink ?? "https://aff",
    link: partial.link ?? "https://x",
    price: partial.price ?? null,
    discount: partial.discount ?? null,
    brand: partial.brand ?? null,
    merchant: partial.merchant ?? null,
    ...partial
  };
}
