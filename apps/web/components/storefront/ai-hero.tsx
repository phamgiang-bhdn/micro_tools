import type React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Search } from "lucide-react";
import { Icon } from "../ui/icon";
import { formatMoney, formatNumber } from "../../lib/format";
import type { FlatProduct, PublicTool } from "../../lib/api";

interface Props {
  tools: PublicTool[];
  featuredDeal: FlatProduct | null;
  productCount: number;
  hotDealCount: number;
}

/**
 * Hero AI-first — cửa vào chính của storefront (thay HomeHero "deal hot" cũ).
 * - Cột chính: pitch "AI tư vấn chọn đồ" + ô search-as-link dẫn vào tool AI + chip theo niche.
 * - Aside: 1 featured deal thật (giữ năng lượng "deal", chứng minh dữ liệu thật).
 * - Nếu chưa có tool nào active → fallback `null`, page tự render hero deal thường.
 */
export function AiHero({ tools, featuredDeal, productCount, hotDealCount }: Props): React.ReactElement | null {
  const primary = tools[0];
  if (!primary) return null;

  const dealKey =
    featuredDeal && featuredDeal.slug && featuredDeal.slug.length > 0 ? featuredDeal.slug : featuredDeal?.id;

  return (
    <section className="relative overflow-hidden border-b border-border bg-canvas">
      <div aria-hidden className="absolute inset-0 bg-hero-mesh" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-700 backdrop-blur">
            <Sparkles className="size-3.5" aria-hidden />
            Trợ lý AI chọn đồ
          </span>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-[2.75rem] sm:leading-[1.1]">
            Không biết chọn gì?{" "}
            <span className="text-gradient-brand">Để AI chọn giúp bạn</span> trong 60 giây.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-ink-soft">
            Mô tả nhu cầu của bạn — AI phân tích spec thật + giá hôm nay từ Shopee, Lazada, TikTok rồi gợi ý 3
            sản phẩm hợp nhất, kèm lý do vì sao.
          </p>

          {/* Ô search-as-link: trông như input, bấm vào là vào tool AI */}
          <Link
            href={`/ai/${primary.slug}?source=home-hero`}
            className="ring-focus group flex items-center gap-3 rounded-2xl border border-border-strong bg-surface px-4 py-3.5 shadow-card transition hover:border-primary-400 hover:shadow-card-md"
          >
            <Search className="size-5 shrink-0 text-ink-mute" aria-hidden />
            <span className="flex-1 truncate text-sm text-ink-mute sm:text-base">
              {primary.tagline ?? `Ví dụ: ${primary.niche.name.toLowerCase()} cho phòng 20m², ngân sách 8 triệu…`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cta-500 px-3.5 py-1.5 text-sm font-semibold text-ink transition group-hover:bg-cta-400">
              <span aria-hidden>🤖</span>
              <span className="hidden sm:inline">Hỏi AI</span>
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          {tools.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-mute">Hoặc chọn nhóm:</span>
              {tools.slice(0, 5).map((t) => (
                <Link
                  key={t.id}
                  href={`/ai/${t.slug}?source=home-hero-chip`}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-primary-300 hover:text-primary-700"
                >
                  {t.niche.name}
                </Link>
              ))}
            </div>
          ) : null}

          <p className="text-[11.5px] text-ink-mute">
            Đang theo dõi {formatNumber(productCount)} sản phẩm trên 4 sàn ·{" "}
            <Link href="#hot-deals" className="font-medium text-primary-700 hover:underline">
              hoặc xem {formatNumber(hotDealCount)} deal hot ngay →
            </Link>
          </p>
        </div>

        {/* Aside: 1 deal thật để chứng minh + giữ năng lượng mua sắm */}
        {featuredDeal && dealKey ? (
          <Link
            href={`/categories/${featuredDeal.nicheSlug}/${dealKey}`}
            className="group relative hidden gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card-lg lg:flex"
          >
            <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-xl bg-canvas">
              {featuredDeal.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featuredDeal.image}
                  alt={featuredDeal.name}
                  className="size-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="grid size-full place-items-center bg-primary-50 text-lg font-bold text-primary-700">
                  {featuredDeal.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              {typeof featuredDeal.discountPercent === "number" && featuredDeal.discountPercent > 0 ? (
                <span className="absolute left-2 top-2 rounded-md bg-cta-500 px-1.5 py-0.5 text-[10.5px] font-bold text-ink shadow">
                  -{featuredDeal.discountPercent}%
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-primary-700">
                AI đang gợi ý nhiều
              </span>
              <p className="mt-0.5 line-clamp-3 text-sm font-semibold leading-snug text-ink group-hover:text-primary-700">
                {featuredDeal.name}
              </p>
              <div className="mt-auto pt-2">
                <div className="flex items-baseline gap-2">
                  {typeof featuredDeal.price === "number" && featuredDeal.price > 0 ? (
                    <span className="text-lg font-bold text-ink">{formatMoney(featuredDeal.price)}</span>
                  ) : null}
                  {typeof featuredDeal.originalPrice === "number" &&
                  featuredDeal.originalPrice > (featuredDeal.price ?? 0) ? (
                    <span className="text-[11.5px] text-ink-mute line-through">
                      {formatMoney(featuredDeal.originalPrice)}
                    </span>
                  ) : null}
                </div>
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 group-hover:gap-1.5">
                  Xem chi tiết <Icon name="arrow-right" size="xs" />
                </span>
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
