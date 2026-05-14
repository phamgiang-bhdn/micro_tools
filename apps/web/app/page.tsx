import type React from "react";
import Link from "next/link";
import { fetchAllProductsFlat, fetchTools } from "../lib/api";
import { ProductCard } from "../components/product-card";
import { EmptyState } from "../components/ui/empty-state";
import { formatMoney, formatNumber } from "../lib/format";

export const revalidate = 300;

interface HomeProps {
  searchParams: Promise<{ tool?: string; sort?: string; q?: string }>;
}

const CODE = "rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-ink border border-line";

export default async function HomePage({ searchParams }: HomeProps): Promise<React.ReactElement> {
  const { tool: activeSlug, sort = "top", q = "" } = await searchParams;
  const { tools, loadError } = await fetchTools();
  const allProducts = loadError ? [] : await fetchAllProductsFlat(tools);

  const query = q.trim().toLowerCase();
  let filtered = activeSlug ? allProducts.filter((p) => p.toolSlug === activeSlug) : allProducts;
  if (query.length > 0) {
    filtered = filtered.filter((p) =>
      [p.name, p.brand, p.store, p.toolName]
        .filter((s): s is string => Boolean(s))
        .some((field) => field.toLowerCase().includes(query))
    );
  }
  const sorted = sortProducts(filtered, sort);

  const topDeals = [...allProducts]
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
    .slice(0, 8);
  const biggestDiscount = topDeals[0]?.discountPercent ?? 0;
  const totalSavings = allProducts.reduce((sum, p) => {
    if (p.originalPrice && p.price && p.originalPrice > p.price) return sum + (p.originalPrice - p.price);
    return sum;
  }, 0);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div aria-hidden className="absolute inset-0 bg-hero-mesh" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-5 animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-card/80 px-3 py-1 text-xs font-medium text-brand-700 backdrop-blur">
                <span aria-hidden className="size-2 rounded-full bg-brand-500 animate-pulse-glow" />
                Cập nhật ưu đãi mỗi giờ
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-5xl">
                Săn deal tốt nhất, <br className="hidden sm:block" />
                <span className="text-gradient-brand">không cần so sánh thủ công</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
                Tổng hợp ưu đãi từ Shopee, Accesstrade và các đối tác chính hãng. Mỗi sản phẩm đều có giá gốc — giá sau ưu đãi rõ ràng để bạn quyết định nhanh.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/?sort=top"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
                >
                  <FlameIcon /> Xem deal hot
                </Link>
                <Link
                  href="#categories"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-5 py-3 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
                >
                  Khám phá theo danh mục →
                </Link>
              </div>
              <StatStrip
                deals={allProducts.length}
                categories={tools.length}
                biggestDiscount={biggestDiscount}
                totalSavings={totalSavings}
              />
            </div>

            {/* Featured deals preview */}
            <div className="relative hidden lg:block">
              <FeaturedPreview deals={topDeals.slice(0, 3)} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {loadError ? (
          <EmptyState
            tone="error"
            title="Không kết nối được API"
            description={
              <div className="space-y-2 text-left">
                <p className="font-mono text-[11px] text-red-700">{loadError}</p>
                <p>
                  Bật backend: <code className={CODE}>npm run dev:api</code>, kiểm tra{" "}
                  <code className={CODE}>API_BASE_URL</code> trong <code className={CODE}>apps/web/.env</code>.
                </p>
              </div>
            }
          />
        ) : null}

        {/* CATEGORY FILTER + SORT — sticky */}
        {tools.length > 0 ? (
          <div
            id="categories"
            className="sticky top-16 z-30 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <nav aria-label="Lọc theo danh mục" className="scrollbar-thin -mx-1 flex flex-1 gap-2 overflow-x-auto px-1">
                <ChipLink
                  href={buildHref({ tool: undefined, sort, q })}
                  active={!activeSlug}
                  label="Tất cả"
                  count={allProducts.length}
                />
                {tools.map((tool) => (
                  <ChipLink
                    key={tool.id}
                    href={buildHref({ tool: tool.slug, sort, q })}
                    active={activeSlug === tool.slug}
                    label={tool.name}
                    count={tool._count?.products ?? 0}
                  />
                ))}
              </nav>
              <SortControl sort={sort} activeSlug={activeSlug} query={q} />
            </div>
            {query ? (
              <p className="mt-2 text-xs text-ink-mute">
                Đang tìm: <span className="font-medium text-ink">“{q}”</span> · {sorted.length} kết quả
                {" · "}
                <Link href={buildHref({ tool: activeSlug, sort, q: "" })} className="text-brand-700 hover:underline">
                  Xoá tìm kiếm
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {!loadError && sorted.length === 0 ? (
          <EmptyState
            tone="warning"
            title={query ? "Không có kết quả phù hợp" : "Chưa có sản phẩm"}
            description={
              query ? (
                <p>Thử bỏ bớt từ khoá hoặc chọn danh mục khác.</p>
              ) : (
                <p>
                  Chạy <code className={CODE}>npm run db:seed</code> rồi tải lại trang.
                </p>
              )
            }
          />
        ) : null}

        {sorted.length > 0 ? (
          <>
            <div className="mb-3 flex items-end justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">
                {activeSlug
                  ? tools.find((t) => t.slug === activeSlug)?.name ?? "Sản phẩm"
                  : query
                    ? "Kết quả tìm kiếm"
                    : "Deal hôm nay"}
              </h2>
              <span className="text-xs text-ink-mute">{sorted.length} sản phẩm</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {sorted.map((product, idx) => (
                <div
                  key={product.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                >
                  <ProductCard product={product} toolSlug={product.toolSlug} />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function sortProducts<T extends { discountPercent?: number; price?: number; name: string }>(
  list: T[],
  sort: string
): T[] {
  const copy = [...list];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    case "price-desc":
      return copy.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case "newest":
      // Backend chưa expose timestamp ở flat list → fallback id desc (id của Prisma ~ tăng theo thời gian)
      return copy.reverse();
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    case "top":
    default:
      return copy.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
  }
}

function buildHref({ tool, sort, q }: { tool?: string; sort?: string; q?: string }): string {
  const params = new URLSearchParams();
  if (tool) params.set("tool", tool);
  if (sort && sort !== "top") params.set("sort", sort);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function StatStrip({
  deals,
  categories,
  biggestDiscount,
  totalSavings
}: {
  deals: number;
  categories: number;
  biggestDiscount: number;
  totalSavings: number;
}): React.ReactElement {
  return (
    <dl className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
      <Stat label="Deal đang sống" value={formatNumber(deals)} />
      <Stat label="Danh mục" value={String(categories)} />
      <Stat label="Giảm sâu nhất" value={biggestDiscount ? `-${biggestDiscount}%` : "—"} tone="brand" />
      <Stat label="Tổng tiết kiệm" value={totalSavings > 0 ? formatMoney(totalSavings) : "—"} tone="accent" />
    </dl>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "brand" | "accent";
}): React.ReactElement {
  const toneClass =
    tone === "brand" ? "text-brand-700" : tone === "accent" ? "text-accent-700" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-card/70 px-3 py-2 backdrop-blur">
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className={`text-base font-bold ${toneClass}`}>{value}</dd>
    </div>
  );
}

function FeaturedPreview({
  deals
}: {
  deals: Array<{ id: string; name: string; image?: string; price?: number; originalPrice?: number; currency?: string; discountPercent?: number; toolSlug: string; slug?: string | null }>;
}): React.ReactElement | null {
  if (deals.length === 0) return null;
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-hero-mesh opacity-70 blur-2xl" aria-hidden />
      <div className="relative grid gap-3">
        {deals.map((deal, idx) => {
          const key = deal.slug && deal.slug.length > 0 ? deal.slug : deal.id;
          return (
            <Link
              key={deal.id}
              href={`/tools/${deal.toolSlug}/${key}`}
              className={`group flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop ${
                idx === 0 ? "scale-105" : ""
              }`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-canvas">
                {deal.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={deal.image} alt={deal.name} className="size-full object-cover transition group-hover:scale-110" />
                ) : (
                  <div className="grid size-full place-items-center bg-gradient-to-br from-brand-50 via-white to-accent-50 text-lg font-bold text-brand-700">
                    {deal.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {deal.discountPercent ? (
                  <span className="absolute left-1 top-1 rounded bg-brand-gradient px-1 py-0.5 text-[10px] font-bold text-white">
                    -{deal.discountPercent}%
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-brand-700">{deal.name}</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  {deal.price !== undefined ? (
                    <span className="text-sm font-bold text-brand-700">{formatMoney(deal.price, deal.currency)}</span>
                  ) : null}
                  {deal.originalPrice && deal.price && deal.originalPrice > deal.price ? (
                    <span className="text-[11px] text-ink-mute line-through">{formatMoney(deal.originalPrice, deal.currency)}</span>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ChipLink({
  href,
  active,
  label,
  count
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}): React.ReactElement {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-ink text-white shadow-card"
          : "border border-line bg-card text-ink-soft hover:border-brand-300 hover:text-brand-700"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs ${active ? "text-white/70" : "text-ink-mute"}`}>{count}</span>
    </Link>
  );
}

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "top", label: "Giảm nhiều nhất" },
  { value: "price-asc", label: "Giá thấp → cao" },
  { value: "price-desc", label: "Giá cao → thấp" },
  { value: "newest", label: "Mới về" },
  { value: "name", label: "Theo tên A-Z" }
];

function SortControl({
  sort,
  activeSlug,
  query
}: {
  sort: string;
  activeSlug?: string;
  query: string;
}): React.ReactElement {
  const current = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
  return (
    <details className="group relative">
      <summary className="inline-flex shrink-0 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
        <SortIcon />
        <span>{current.label}</span>
        <ChevronIcon />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-card-lg">
        {SORT_OPTIONS.map((option) => {
          const active = option.value === sort;
          return (
            <Link
              key={option.value}
              href={buildHref({ tool: activeSlug, sort: option.value, q: query })}
              scroll={false}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-canvas hover:text-ink"
              }`}
            >
              <span>{option.label}</span>
              {active ? <CheckIcon /> : null}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function FlameIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M12 2c.7 3.4-.6 5.9-2.6 7.7-2 1.9-3.4 4-3.4 6.7A6 6 0 0 0 12 22a6 6 0 0 0 6-5.6c0-3.3-2.4-4.7-2.4-7.2 0-1.2.5-2 .9-2.9-1.7.6-2.7 1.5-2.7 3.3 0 1 .4 1.7.4 2.6 0 1-.7 1.8-1.6 1.8-1 0-1.6-.9-1.6-2 0-3.2 3-4 1-10Z" />
    </svg>
  );
}

function SortIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="M3 6h13M3 12h9M3 18h5M17 6v12m0 0-3-3m3 3 3-3" />
    </svg>
  );
}

function ChevronIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-3 transition group-open:rotate-180">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-brand-700">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}
