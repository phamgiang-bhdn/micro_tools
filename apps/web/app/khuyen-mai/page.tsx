import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { fetchAllCoupons, type PublicCoupon } from "../../lib/api";
import { CouponCardV2 } from "../../components/storefront/coupon-card";
import { CouponHero } from "../../components/storefront/coupon-hero";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const now = new Date();
  return {
    title: `Mã giảm giá tháng ${now.getMonth() + 1}/${now.getFullYear()} — Lazada, Shopee, TikTok, Tiki`,
    description:
      "Tổng hợp mã giảm giá còn dùng từ các sàn lớn. Đã kiểm duyệt, có countdown hạn dùng, sao chép 1-tap.",
    alternates: { canonical: "/khuyen-mai" }
  };
}

interface PageProps {
  searchParams: Promise<{ merchant?: string }>;
}

export default async function CouponsIndexPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const { merchant } = await searchParams;
  const all = await fetchAllCoupons(100);
  const active = all.filter((c) => !c.expiresAt || new Date(c.expiresAt).getTime() > Date.now());
  const filtered = merchant ? active.filter((c) => c.merchantSlug === merchant) : active;
  const merchants = countByMerchant(active);
  const featured = [...filtered].sort(byDiscountDesc).slice(0, 3);
  const rest = filtered.filter((c) => !featured.find((f) => f.id === c.id));

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <CouponHero coupons={active} />

      {merchants.length > 0 ? (
        <div className="sticky top-16 z-30 -mx-4 overflow-x-auto border-y border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex items-center gap-2">
            <ChipLink href="/khuyen-mai" active={!merchant} label={`Tất cả (${active.length})`} />
            {merchants.map((m) => (
              <ChipLink
                key={m.slug}
                href={`/khuyen-mai?merchant=${m.slug}`}
                active={merchant === m.slug}
                label={`${m.display} (${m.count})`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {featured.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-mute">
                🔥 Top giảm sâu nhất
              </h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {featured.map((c) => (
                  <CouponCardV2 key={c.id} coupon={c} />
                ))}
              </div>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-mute">
                Tất cả mã
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((c) => (
                  <CouponCardV2 key={c.id} coupon={c} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <JsonLd coupons={filtered} />
    </main>
  );
}

function byDiscountDesc(a: PublicCoupon, b: PublicCoupon): number {
  const av = a.discountPercent ?? Number(a.discountAmount ?? 0) / 1000;
  const bv = b.discountPercent ?? Number(b.discountAmount ?? 0) / 1000;
  return bv - av;
}

function countByMerchant(coupons: PublicCoupon[]) {
  const map = new Map<string, { slug: string; display: string; count: number }>();
  for (const c of coupons) {
    if (!c.merchantSlug) continue;
    const cur = map.get(c.merchantSlug);
    if (cur) cur.count++;
    else map.set(c.merchantSlug, { slug: c.merchantSlug, display: c.merchantDisplay ?? c.merchantSlug, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function ChipLink({ href, active, label }: { href: string; active: boolean; label: string }): React.ReactElement {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-ink text-white" : "border border-line bg-card text-ink-soft hover:border-primary-300 hover:text-primary-700"
      }`}
    >
      {label}
    </Link>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
      <p className="text-base font-semibold text-ink">Chưa có mã đang còn dùng</p>
      <p className="mt-2 text-sm text-ink-soft">
        Quay lại sau 6h để xem mã mới, hoặc đọc{" "}
        <Link href="/blog" className="text-primary-700 hover:underline">
          cẩm nang chọn mua
        </Link>
        .
      </p>
    </div>
  );
}

function JsonLd({ coupons }: { coupons: PublicCoupon[] }): React.ReactElement {
  const site = process.env.SITE_URL ?? "http://localhost:3100";
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${site}/` },
          { "@type": "ListItem", position: 2, name: "Mã giảm giá", item: `${site}/khuyen-mai` }
        ]
      },
      {
        "@type": "ItemList",
        itemListElement: coupons.slice(0, 30).map((c, i) => ({
          "@type": "Offer",
          position: i + 1,
          url: c.affiliateUrl ?? `${site}/khuyen-mai/${c.merchantSlug ?? ""}`,
          name: c.description ?? "Khuyến mại",
          validThrough: c.expiresAt ?? undefined
        }))
      }
    ]
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
