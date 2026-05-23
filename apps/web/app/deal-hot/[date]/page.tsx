import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { trackAndRedirectAction } from "../../actions/tracking";
import { fetchAllProductsFlat, fetchNiches, type FlatProduct } from "../../../lib/api";
import { BRAND } from "../../../lib/brand";
import { formatMoney } from "../../../lib/format";
import { isValidYmd, todayVN, vnDateOffset, formatVnDate } from "../../../lib/date";

interface PageProps {
  params: Promise<{ date?: string }>;
}

function resolveDate(date: string | undefined): { date: string; isToday: boolean } | null {
  if (!date) return null;
  if (!isValidYmd(date)) return null;
  return { date, isToday: date === todayVN() };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const resolved = resolveDate(date);
  if (!resolved) return { title: "Deal hot" };
  const dateLabel = formatVnDate(resolved.date);
  return {
    title: `Top 10 deal hot ${dateLabel} — ${BRAND.name}`,
    description: `Top deal được đối chiếu giá ngày ${dateLabel}. Mua qua ${BRAND.name}, đối tác chính thức Lazada, Shopee, TikTok Shop, Tiki.`,
    alternates: { canonical: `/deal-hot/${resolved.date}` },
    openGraph: {
      type: "website",
      title: `Top 10 deal hot ${dateLabel}`,
      description: `Deal được đối chiếu giá ngày ${dateLabel}.`
    }
  };
}

export default async function DealHotPage({ params }: PageProps): Promise<React.ReactElement> {
  const { date } = await params;
  const resolved = resolveDate(date);
  if (!resolved) notFound();

  const { niches } = await fetchNiches();
  const products = await fetchAllProductsFlat(niches);
  const top = products
    .filter((p) => p.price && p.discountPercent)
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
    .slice(0, 10);

  const dateLabel = formatVnDate(resolved.date);
  const maxDiscount = top[0]?.discountPercent ?? 0;
  const updatedAt = new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="mx-auto max-w-[480px] bg-canvas pb-12">
      <header className="border-b border-line bg-card px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">{BRAND.name}</p>
        <p className="text-xs text-ink-mute">{BRAND.taglineShort}</p>
      </header>

      <section className="border-b border-line bg-gradient-to-b from-rose-50 to-card px-4 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">🔥 Deal hot</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight text-ink">
          Top 10 deal {dateLabel}
        </h1>
        <p className="mt-1 text-xs text-ink-mute">
          Cập nhật {updatedAt} • {dateLabel}
        </p>
        <p className="mt-3 text-lg font-bold text-rose-600">
          Giảm tới {maxDiscount}%
        </p>
      </section>

      {top.length === 0 ? (
        <EmptyState date={resolved.date} />
      ) : (
        <section className="space-y-3 px-4 py-5">
          {top.map((p, idx) => (
            <DealCard key={p.id} product={p} position={idx + 1} hero={idx === 0} isToday={resolved.isToday} />
          ))}
        </section>
      )}

      <SubscribeCta />

      <footer className="border-t border-line px-4 py-5 text-center text-[11px] text-ink-mute">
        <p>
          Một số liên kết trên trang có thể giúp chúng tôi nhận hoa hồng.
        </p>
        <p className="mt-2">
          <Link href="/" className="text-brand-700 hover:underline">
            ← Về trang chủ {BRAND.name}
          </Link>
        </p>
      </footer>
    </main>
  );
}

function DealCard({
  product,
  position,
  hero,
  isToday
}: {
  product: FlatProduct;
  position: number;
  hero: boolean;
  isToday: boolean;
}): React.ReactElement {
  const sold = product.salesCount ?? 0;
  const price = product.price ? formatMoney(product.price, product.currency ?? "VND") : null;
  const original = product.originalPrice ? formatMoney(product.originalPrice, product.currency ?? "VND") : null;

  return (
    <article className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${hero ? "border-rose-300" : "border-line"}`}>
      <div className="relative">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className={`w-full object-cover ${hero ? "aspect-[16/10]" : "aspect-[16/11]"}`}
            loading={hero ? "eager" : "lazy"}
          />
        ) : (
          <div className={`grid w-full place-items-center bg-brand-50 text-3xl ${hero ? "aspect-[16/10]" : "aspect-[16/11]"}`}>
            🛒
          </div>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${hero ? "bg-rose-600" : "bg-ink/80"}`}>
            #{position}
          </span>
          {hero ? <span>👑</span> : null}
        </div>
        {product.discountPercent ? (
          <div className="absolute right-2 top-2 rounded-full bg-rose-600 px-3 py-1 text-sm font-extrabold text-white shadow">
            -{product.discountPercent}%
          </div>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        {product.brand ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{product.brand}</p>
        ) : null}
        <h2 className="text-[15px] font-semibold leading-snug text-ink line-clamp-2">{product.name}</h2>
        <div className="flex items-baseline gap-2">
          {price ? <span className="text-lg font-bold text-rose-600">{price}</span> : null}
          {original ? <span className="text-xs text-ink-mute line-through">{original}</span> : null}
        </div>
        {sold > 0 ? (
          <p className="text-[11px] text-ink-mute">🔥 {sold.toLocaleString("vi-VN")} người đã mua</p>
        ) : null}

        {isToday ? (
          <form action={trackAndRedirectAction}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="affiliateUrl" value={product.affiliateUrl ?? ""} />
            <button
              type="submit"
              className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Xem deal ngay →
            </button>
          </form>
        ) : (
          <Link
            href={`/categories/${product.nicheSlug}/${product.slug ?? product.id}`}
            className="mt-1 inline-flex w-full items-center justify-center rounded-full border border-line bg-canvas px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand-300 hover:text-brand-700"
          >
            Xem chi tiết
          </Link>
        )}
      </div>
    </article>
  );
}

function SubscribeCta(): React.ReactElement {
  return (
    <section className="mx-4 mt-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-5 text-center">
      <p className="text-sm font-semibold text-ink">Hết deal hôm nay rồi?</p>
      <p className="mt-1 text-xs text-ink-soft">📧 Đăng ký nhận deal mỗi sáng 7:00.</p>
      <form
        action="/api/subscribe"
        method="POST"
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="email@cuaban.com"
          className="h-10 flex-1 rounded-full border border-line bg-card px-4 text-sm"
        />
        <input type="hidden" name="source" value="deal_hot_footer" />
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white"
        >
          Đăng ký
        </button>
      </form>
    </section>
  );
}

function EmptyState({ date }: { date: string }): React.ReactElement {
  return (
    <section className="space-y-3 px-4 py-10 text-center">
      <p className="text-3xl">🌙</p>
      <p className="text-base font-semibold text-ink">Chưa có deal hot cho ngày này</p>
      <p className="text-sm text-ink-soft">
        Team {BRAND.name} đang đối chiếu deal mới. Quay lại sau 6h.
      </p>
      <div className="flex justify-center gap-3 pt-3">
        <Link
          href={`/deal-hot/${vnDateOffset(-1)}`}
          className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand-300"
        >
          Deal hôm qua →
        </Link>
        <Link
          href="/blog"
          className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand-300"
        >
          Cẩm nang
        </Link>
      </div>
      <p className="pt-2 text-[10px] text-ink-mute">Ngày: {date}</p>
    </section>
  );
}
