"use client";

import * as React from "react";
import Image from "next/image";
import { Share2, ShoppingCart, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { formatMoney } from "../../../../../lib/format";
import { createTrackingRedirect } from "../../../../actions/tracking";
import { submitWaitlistAction } from "../../../../actions/waitlist";
import { MarketplacePrices, extractMarketplaceListings } from "./marketplace-prices";
import type { ProductView } from "../../../../../lib/types";
import type { ToolSessionResponse } from "../../../../../lib/api";

export interface ResultCardsProps {
  products: {
    id: string;
    view: ProductView;
    affiliateUrl: string;
    raw: Record<string, unknown>;
  }[];
  session: ToolSessionResponse;
  toolSlug: string;
}

export function ResultCards({ products, session, toolSlug }: ResultCardsProps): React.ReactElement {
  const [showAll, setShowAll] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState<string | null>(null);
  const [emailSubmitted, setEmailSubmitted] = React.useState(false);

  // Persist session info to localStorage for restore
  React.useEffect(() => {
    try {
      localStorage.setItem(
        "dealvault:last-session",
        JSON.stringify({
          sessionId: session.id,
          shareSlug: session.shareSlug,
          toolSlug,
          nicheSlug: session.tool.niche.slug,
          nicheName: session.tool.niche.name,
          timestamp: Date.now()
        })
      );
    } catch {
      /* localStorage blocked (private mode, etc) */
    }
  }, [session.id, session.shareSlug, toolSlug, session.tool.niche.slug, session.tool.niche.name]);

  const top = products[0];
  const rest = products.slice(1);

  const handleStickyClick = async (productId: string, affiliateUrl: string): Promise<void> => {
    setRedirecting(productId);
    try {
      const tracked = await createTrackingRedirect({ productId, affiliateUrl });
      window.location.href = tracked.finalUrl || affiliateUrl;
    } catch {
      window.location.href = affiliateUrl;
    }
  };

  if (!top) return <></>;

  const reasonings = session.aiReasonings ?? {};

  return (
    <div className="mt-8 space-y-6">
      {/* #1 prominent card */}
      <PrimaryCard
        product={top}
        reasoning={reasonings[top.id]?.reasoning}
        confidenceLabel={getConfidenceLabel(top.id, session)}
        rank={1}
        shareSlug={session.shareSlug}
        toolId={session.toolId}
        quizSessionId={session.id}
      />

      {/* #2 + #3 — collapsed by default sometimes */}
      {rest.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink transition hover:border-google-blue"
          >
            <span className="font-medium">
              {showAll ? "Thu gọn" : `Hoặc xem ${rest.length} lựa chọn khác ↓`}
            </span>
            <ChevronDown
              className={`size-4 transition ${showAll ? "rotate-180" : ""}`}
            />
          </button>

          {showAll && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rest.map((p, idx) => (
                <SecondaryCard
                  key={p.id}
                  product={p}
                  reasoning={reasonings[p.id]?.reasoning}
                  confidenceLabel={getConfidenceLabel(p.id, session)}
                  rank={idx + 2}
                  shareSlug={session.shareSlug}
                  toolId={session.toolId}
                  quizSessionId={session.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Email capture inline */}
      <EmailCaptureInline
        sessionId={session.id}
        nicheName={session.tool.niche.name}
        submitted={emailSubmitted}
        onSubmitted={() => setEmailSubmitted(true)}
      />

      {/* Share */}
      {session.shareSlug && (
        <ShareBox shareSlug={session.shareSlug} nicheName={session.tool.niche.name} />
      )}

      {/* Sticky mobile CTA */}
      <StickyCta
        product={top}
        onClick={() => handleStickyClick(top.id, top.affiliateUrl)}
        redirecting={redirecting === top.id}
      />
    </div>
  );
}

function getConfidenceLabel(productId: string, session: ToolSessionResponse): string {
  // We have score in aiReasonings? No — score lives in scored array which we didn't persist.
  // For now derive from order: #1 = "Rất phù hợp", #2-3 = "Phù hợp".
  const idx = session.recommendedProductIds.indexOf(productId);
  if (idx === 0) return "Rất phù hợp";
  if (idx <= 2) return "Phù hợp";
  return "Có thể cân nhắc";
}

function PrimaryCard({
  product,
  reasoning,
  confidenceLabel,
  rank,
  shareSlug,
  toolId,
  quizSessionId
}: {
  product: ResultCardsProps["products"][number];
  reasoning?: string;
  confidenceLabel: string;
  rank: number;
  shareSlug?: string | null;
  toolId?: string;
  quizSessionId?: string;
}): React.ReactElement {
  const v = product.view;
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
      <div className="bg-brand-gradient px-4 py-1.5 text-xs font-semibold text-white">
        🏆 #{rank} · AI gợi ý cho bạn
      </div>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[160px_1fr] sm:p-6">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-canvas">
          {v.image ? (
            <Image src={v.image} alt={v.name} fill className="object-contain" sizes="160px" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">📦</div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{v.name}</h3>
          {v.brand && <p className="mt-0.5 text-xs text-ink-soft">{v.brand}</p>}

          <div className="mt-3 flex items-baseline gap-2">
            {v.price > 0 && (
              <span className="text-xl font-bold text-brand-700">
                {formatMoney(v.price)}
              </span>
            )}
            {v.originalPrice && v.originalPrice > v.price && (
              <>
                <span className="text-sm text-ink-soft line-through">
                  {formatMoney(v.originalPrice)}
                </span>
                {v.discountPercent && (
                  <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                    -{v.discountPercent}%
                  </span>
                )}
              </>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-google-blue/20 bg-google-blue/5 p-3.5">
            <p className="flex items-start gap-2 text-sm text-ink">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-google-blue" />
              <span>
                <span className="font-semibold text-google-blue">{confidenceLabel}.</span>{" "}
                {reasoning ?? "Top match từ scoring engine."}
              </span>
            </p>
          </div>

          <div className="mt-4">
            <MarketplacePrices
              productId={product.id}
              productName={v.name}
              defaultAffiliateUrl={product.affiliateUrl}
              defaultPrice={v.price}
              listings={extractMarketplaceListings(product.raw.scrapedData)}
              shareSlug={shareSlug}
              toolId={toolId}
              quizSessionId={quizSessionId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryCard({
  product,
  reasoning,
  confidenceLabel,
  rank,
  shareSlug,
  toolId,
  quizSessionId
}: {
  product: ResultCardsProps["products"][number];
  reasoning?: string;
  confidenceLabel: string;
  rank: number;
  shareSlug?: string | null;
  toolId?: string;
  quizSessionId?: string;
}): React.ReactElement {
  const v = product.view;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line bg-canvas px-3 py-1 text-[11px] font-medium text-ink-soft">
        #{rank}
      </div>
      <div className="p-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-canvas">
          {v.image ? (
            <Image src={v.image} alt={v.name} fill className="object-contain" sizes="200px" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl">📦</div>
          )}
        </div>
        <h4 className="mt-3 line-clamp-2 text-sm font-semibold text-ink">{v.name}</h4>
        {v.price > 0 && (
          <p className="mt-1 text-base font-bold text-brand-700">{formatMoney(v.price)}</p>
        )}
        <div className="mt-2 rounded-lg border border-line bg-canvas p-2.5">
          <p className="line-clamp-3 text-xs text-ink">
            <span className="font-semibold text-google-blue">🤖 {confidenceLabel}.</span>{" "}
            {reasoning ?? "Match từ scoring."}
          </p>
        </div>
        <div className="mt-3">
          <MarketplacePrices
            productId={product.id}
            productName={v.name}
            defaultAffiliateUrl={product.affiliateUrl}
            defaultPrice={v.price}
            listings={extractMarketplaceListings(product.raw.scrapedData)}
            compact
            shareSlug={shareSlug}
            toolId={toolId}
            quizSessionId={quizSessionId}
          />
        </div>
      </div>
    </div>
  );
}

function EmailCaptureInline({
  sessionId,
  nicheName,
  submitted,
  onSubmitted
}: {
  sessionId: string;
  nicheName: string;
  submitted: boolean;
  onSubmitted: () => void;
}): React.ReactElement {
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);

  if (submitted) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-center text-sm text-ink">
        ✓ Đã đăng ký — sẽ gửi alert khi có deal {nicheName.toLowerCase()} phù hợp.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Email không hợp lệ");
      return;
    }
    setPending(true);
    try {
      const nicheSlug =
        typeof window !== "undefined"
          ? new URL(window.location.href).pathname.split("/")[2] ?? ""
          : "";
      const result = await submitWaitlistAction({
        email,
        nicheSlug,
        surveyAnswer: `From tool result: ${sessionId.slice(0, 8)}`,
        source: "tool-result"
      });
      if (result.ok) {
        onSubmitted();
      } else {
        alert(result.error ?? "Đăng ký thất bại");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-line bg-white p-4 sm:p-5"
    >
      <p className="text-sm font-medium text-ink">
        💡 Muốn được nhắc khi giá xuống hoặc có deal mới?
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-google-blue"
        />
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Đang gửi..." : "Đăng ký"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">
        Chỉ email khi có deal phù hợp nhu cầu bạn. Có nút unsubscribe.
      </p>
    </form>
  );
}

function ShareBox({ shareSlug, nicheName }: { shareSlug: string; nicheName: string }): React.ReactElement {
  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${shareSlug}` : `/r/${shareSlug}`;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      alert("✓ Đã copy link!");
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="rounded-xl border border-line bg-canvas p-4 text-center text-sm">
      <p className="font-medium text-ink">Chia sẻ kết quả cho bạn bè xin ý kiến</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-google-blue"
        >
          <Share2 className="mr-1 inline size-3" /> Copy link
        </button>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-google-blue"
        >
          Facebook
        </a>
        <a
          href={`https://zalo.me/share?u=${encodeURIComponent(url)}&t=${encodeURIComponent(`AI gợi ý ${nicheName} cho mình`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-google-blue"
        >
          Zalo
        </a>
      </div>
    </div>
  );
}

function StickyCta({
  product,
  onClick,
  redirecting
}: {
  product: ResultCardsProps["products"][number];
  onClick: () => void;
  redirecting: boolean;
}): React.ReactElement {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 p-3 backdrop-blur sm:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Button onClick={onClick} disabled={redirecting} variant="brand" size="lg" className="w-full">
        {redirecting ? (
          "Đang chuyển..."
        ) : (
          <>
            <ShoppingCart className="size-4" /> Mua {product.view.name.split(" ").slice(0, 2).join(" ")}
            {product.view.price > 0 && ` · ${formatMoney(product.view.price)}`}
          </>
        )}
      </Button>
    </div>
  );
}
