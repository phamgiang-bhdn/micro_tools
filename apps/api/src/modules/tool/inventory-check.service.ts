import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * InventoryCheckService — Story 5.6.
 *
 * Mỗi 6h scan Product PUBLISHED, ping marketplace API (Tiki primarily) để check
 * `IN_STOCK | OOS | UNKNOWN`. Set vào `scrapedData.inventoryStatus` để scoring engine
 * (hardFilters) skip OOS product.
 *
 * Phase 1 implementation: chỉ check Tiki bằng product URL extract + lightweight HEAD ping.
 * Phase 2: full Tiki Products API integration (cần register API key) + Shopee scrape.
 *
 * Env:
 *  - INVENTORY_CHECK_ENABLED (default false để khỏi đốt rate limit trong dev)
 *  - INVENTORY_CHECK_CRON (default "0 *\/6 * * *")
 */
@Injectable()
export class InventoryCheckService {
  private readonly logger = new Logger(InventoryCheckService.name);
  private readonly enabled = process.env.INVENTORY_CHECK_ENABLED === "true";

  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.INVENTORY_CHECK_CRON ?? "0 */6 * * *")
  async scheduledCheck(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug("InventoryCheck cron disabled (INVENTORY_CHECK_ENABLED != 'true').");
      return;
    }
    await this.runCheck();
  }

  /** Public trigger cho admin button — gọi từ AdminController. */
  async runCheck(): Promise<{ checked: number; flaggedOOS: number; flaggedUnknown: number; oosByNiche: Record<string, number> }> {
    const products = await this.prisma.product.findMany({
      where: { isPublic: true, niche: { status: "ACTIVE" } },
      select: {
        id: true,
        affiliateUrl: true,
        scrapedData: true,
        niche: { select: { slug: true } }
      },
      take: 500
    });

    this.logger.log(`Checking inventory for ${products.length} active product(s)...`);

    let flaggedOOS = 0;
    let flaggedUnknown = 0;
    const oosByNiche: Record<string, number> = {};

    for (const p of products) {
      const status = await this.checkSingleProduct(p.affiliateUrl);
      const current = (p.scrapedData as Record<string, unknown> | null)?.inventoryStatus;
      if (current === status) continue;

      const updated = { ...(p.scrapedData as Record<string, unknown> | null), inventoryStatus: status, inventoryCheckedAt: new Date().toISOString() };
      await this.prisma.product.update({
        where: { id: p.id },
        data: { scrapedData: updated as never }
      });

      if (status === "OOS") {
        flaggedOOS += 1;
        const slug = p.niche?.slug ?? "unknown";
        oosByNiche[slug] = (oosByNiche[slug] ?? 0) + 1;
      } else if (status === "UNKNOWN") {
        flaggedUnknown += 1;
      }

      // Sleep 250ms giữa product để không spam marketplace
      await new Promise((r) => setTimeout(r, 250));
    }

    this.logger.log(
      `InventoryCheck done: checked=${products.length}, OOS=${flaggedOOS}, UNKNOWN=${flaggedUnknown}`
    );

    return { checked: products.length, flaggedOOS, flaggedUnknown, oosByNiche };
  }

  /**
   * Check 1 product. Phase 1: HEAD request đến affiliate URL; nếu 200 → IN_STOCK,
   * 404/410 → OOS, else UNKNOWN.
   *
   * Phase 2 cần parse JSON response từ Tiki/Shopee API thật để biết chính xác stock count.
   */
  private async checkSingleProduct(affiliateUrl: string): Promise<"IN_STOCK" | "OOS" | "UNKNOWN"> {
    try {
      const target = this.resolveRealUrl(affiliateUrl);
      if (!target) return "UNKNOWN";

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(target, { method: "HEAD", redirect: "follow", signal: controller.signal });
      clearTimeout(t);

      if (res.ok) return "IN_STOCK";
      if (res.status === 404 || res.status === 410) return "OOS";
      return "UNKNOWN";
    } catch (err: unknown) {
      this.logger.debug(
        `inventory check fail for ${affiliateUrl}: ${err instanceof Error ? err.message : err}`
      );
      return "UNKNOWN";
    }
  }

  /**
   * Affiliate URL thường wrap qua Accesstrade. Extract real `desturl` param nếu có,
   * else fallback URL nguyên.
   */
  private resolveRealUrl(affiliateUrl: string): string | null {
    try {
      const u = new URL(affiliateUrl);
      const dest = u.searchParams.get("url") || u.searchParams.get("desturl") || u.searchParams.get("u");
      if (dest) {
        try {
          return new URL(decodeURIComponent(dest)).toString();
        } catch {
          /* fall through */
        }
      }
      return u.toString();
    } catch {
      return null;
    }
  }
}
