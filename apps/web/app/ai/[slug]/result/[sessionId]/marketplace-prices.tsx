"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { formatMoney } from "../../../../../lib/format";
import { createTrackingRedirect } from "../../../../actions/tracking";
import { InterstitialRedirect } from "../../../../../components/storefront/interstitial-redirect";

export interface MarketplaceListing {
  marketplace: string; // "tiki" | "shopee" | "lazada" | "tiktokshop"
  price: number;
  url: string;
  lastChecked?: string;
}

interface MarketplacePricesProps {
  productId: string;
  productName: string;
  defaultAffiliateUrl: string;
  defaultPrice: number;
  listings?: MarketplaceListing[] | null;
  compact?: boolean;
  /** Nếu có shareSlug → show interstitial với save-link CTA trước redirect. */
  shareSlug?: string | null;
  /** Tool tracking (cho ClickLog + email drip enqueue). */
  toolId?: string;
  quizSessionId?: string;
}

const MARKETPLACE_META: Record<string, { label: string; logo?: string; tone: string }> = {
  tiki: { label: "Tiki", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  shopee: { label: "Shopee", tone: "border-orange-200 bg-orange-50 text-orange-700" },
  lazada: { label: "Lazada", tone: "border-purple-200 bg-purple-50 text-purple-700" },
  tiktokshop: { label: "TikTok Shop", tone: "border-pink-200 bg-pink-50 text-pink-700" }
};

export function MarketplacePrices({
  productId,
  defaultAffiliateUrl,
  listings,
  compact = false,
  shareSlug,
  toolId,
  quizSessionId
}: MarketplacePricesProps): React.ReactElement {
  const [redirecting, setRedirecting] = React.useState<string | null>(null);
  const [interstitial, setInterstitial] = React.useState<{
    open: boolean;
    destination: string;
    marketplace: string;
  }>({ open: false, destination: "", marketplace: "" });

  const handleClick = async (marketplace: string, url: string): Promise<void> => {
    const key = `${productId}-${marketplace}`;
    setRedirecting(key);
    try {
      const tracked = await createTrackingRedirect({
        productId,
        affiliateUrl: url,
        toolId,
        quizSessionId,
        marketplace
      });
      const finalUrl = tracked.finalUrl || url;

      if (shareSlug) {
        // Show interstitial 2s với save-link CTA
        setInterstitial({ open: true, destination: finalUrl, marketplace });
        setRedirecting(null);
      } else {
        window.location.href = finalUrl;
      }
    } catch {
      window.location.href = url;
    }
  };

  const closeInterstitial = (): void => {
    setInterstitial((s) => ({ ...s, open: false }));
  };

  const saveLink =
    typeof window !== "undefined" && shareSlug ? `${window.location.origin}/r/${shareSlug}` : undefined;

  const interstitialNode = (
    <InterstitialRedirect
      open={interstitial.open}
      onClose={closeInterstitial}
      destination={interstitial.destination}
      marketplace={interstitial.marketplace}
      saveLink={saveLink}
    />
  );

  // Nếu không có multi-listing → fallback single CTA
  if (!listings || listings.length === 0) {
    return (
      <>
        <Button
          onClick={() => handleClick("default", defaultAffiliateUrl)}
          disabled={redirecting === `${productId}-default`}
          variant="brand"
          size={compact ? "md" : "lg"}
          className="w-full"
        >
          {redirecting ? "Đang chuyển..." : "🛒 Xem giá ngay"}
        </Button>
        {interstitialNode}
      </>
    );
  }

  const sorted = [...listings].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0]!;
  const others = sorted.slice(1, compact ? 2 : 4);
  const cheapestMeta = MARKETPLACE_META[cheapest.marketplace.toLowerCase()] ?? {
    label: cheapest.marketplace,
    tone: "border-line bg-white text-ink"
  };

  const savings =
    others.length > 0 && others[0]!.price > cheapest.price
      ? Math.round(((others[0]!.price - cheapest.price) / others[0]!.price) * 100)
      : 0;

  return (
    <div className="space-y-2">
      {interstitialNode}
      <Button
        onClick={() => handleClick(cheapest.marketplace, cheapest.url)}
        disabled={redirecting === `${productId}-${cheapest.marketplace}`}
        variant="brand"
        size={compact ? "md" : "lg"}
        className="w-full"
      >
        {redirecting === `${productId}-${cheapest.marketplace}` ? (
          "Đang chuyển..."
        ) : (
          <>
            🛒 Mua trên {cheapestMeta.label} · {formatMoney(cheapest.price)}
            {savings > 0 && (
              <span className="ml-1 rounded-md bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">
                rẻ hơn -{savings}%
              </span>
            )}
          </>
        )}
      </Button>

      {others.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-ink-soft">Xem trên:</span>
          {others.map((l) => {
            const meta = MARKETPLACE_META[l.marketplace.toLowerCase()] ?? {
              label: l.marketplace,
              tone: "border-line bg-white text-ink"
            };
            const key = `${productId}-${l.marketplace}`;
            return (
              <button
                key={l.marketplace}
                type="button"
                onClick={() => handleClick(l.marketplace, l.url)}
                disabled={redirecting === key}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition hover:brightness-95 ${meta.tone}`}
              >
                {meta.label} · {formatMoney(l.price)}
                <ExternalLink className="size-3" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Helper to extract listings from scrapedData safely. */
export function extractMarketplaceListings(scrapedData: unknown): MarketplaceListing[] | null {
  if (!scrapedData || typeof scrapedData !== "object") return null;
  const raw = (scrapedData as Record<string, unknown>).marketplaceListings;
  if (!Array.isArray(raw)) return null;
  const listings: MarketplaceListing[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const i = item as Record<string, unknown>;
    if (typeof i.marketplace !== "string" || typeof i.url !== "string") continue;
    const price = Number(i.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    listings.push({
      marketplace: i.marketplace,
      price,
      url: i.url,
      lastChecked: typeof i.lastChecked === "string" ? i.lastChecked : undefined
    });
  }
  return listings.length > 0 ? listings : null;
}
