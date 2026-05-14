import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney, formatNumber, normalizeProduct } from "../lib/format";
import { createTrackingRedirect } from "../app/actions/tracking";
import { Breadcrumb } from "./ui/breadcrumb";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { ProductItem } from "../lib/types";

interface ProductDetailViewProps {
  productRaw: ProductItem;
  tool: { name: string; slug: string };
  previewMode?: boolean;
}

export function ProductDetailView({
  productRaw,
  tool,
  previewMode = false
}: ProductDetailViewProps): React.ReactElement {
  const product = normalizeProduct(productRaw);
  const jsonLd = buildProductJsonLd(product, tool.name);

  return (
    <div className="space-y-8">
      {!previewMode ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      {previewMode ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900 shadow-card">
          <p className="font-semibold">PREVIEW MODE — chưa publish</p>
          <p className="mt-0.5 text-xs">
            Trang này dựng từ bản AI extraction đang chờ duyệt. Nút &quot;Mua ngay&quot; tạm khoá.
            Đóng tab và Approve trong Refinery để go-live.
          </p>
        </div>
      ) : null}

      <Breadcrumb
        items={[
          { label: "Trang chủ", href: previewMode ? "/admin" : "/" },
          { label: tool.name, href: previewMode ? "/admin?tab=refinery" : `/tools/${tool.slug}` },
          { label: product.name }
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-3xl border border-line bg-card shadow-card">
          <div className="relative aspect-[4/3] w-full bg-canvas">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt={product.name}
                width={1200}
                height={900}
                loading="eager"
                decoding="async"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 text-5xl font-bold text-brand-700">
                {product.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
              {product.discountPercent && product.discountPercent > 0 ? (
                <Badge tone="brand" size="md">-{product.discountPercent}%</Badge>
              ) : null}
              {product.badge ? <Badge tone="ink" size="md">{product.badge}</Badge> : null}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div>
            {product.brand ? (
              <p className="text-xs font-medium uppercase tracking-wider text-ink-mute">{product.brand}</p>
            ) : null}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{product.name}</h1>
            {product.rating !== undefined ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
                <span aria-hidden className="text-amber-500">{"★".repeat(Math.round(product.rating))}</span>
                <span className="font-medium text-ink">{product.rating.toFixed(1)}</span>
                {product.reviewCount ? (
                  <span className="text-ink-mute">({formatNumber(product.reviewCount)} đánh giá)</span>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-canvas p-5">
            {product.price !== undefined ? (
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold text-brand-700">
                  {formatMoney(product.price, product.currency)}
                </span>
                {product.originalPrice && product.originalPrice > product.price ? (
                  <span className="text-sm text-ink-mute line-through">
                    {formatMoney(product.originalPrice, product.currency)}
                  </span>
                ) : null}
                {product.store ? <Badge tone="neutral">Bán bởi {product.store}</Badge> : null}
              </div>
            ) : (
              <p className="text-base font-medium text-ink-soft">Liên hệ shop</p>
            )}
            {product.description ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{product.description}</p>
            ) : null}
          </div>

          {previewMode ? (
            <div>
              <Button type="button" variant="brand" size="lg" className="w-full cursor-not-allowed opacity-60 sm:w-auto" disabled>
                Mua ngay → (khoá ở preview)
              </Button>
              <p className="mt-2 text-xs text-ink-mute">
                Approve qua Refinery để bật click tracking thật.
              </p>
            </div>
          ) : (
            <form
              action={async () => {
                "use server";
                const tracked = await createTrackingRedirect({
                  productId: product.id,
                  affiliateUrl: productRaw.affiliateUrl
                });
                redirect(tracked.finalUrl);
              }}
            >
              <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto">
                Mua ngay →
              </Button>
              <p className="mt-2 text-xs text-ink-mute">
                Bạn sẽ được chuyển sang website của {product.store ?? "shop"} để hoàn tất đơn hàng.
              </p>
            </form>
          )}

          {product.highlights && product.highlights.length > 0 ? (
            <div className="rounded-2xl border border-line bg-card p-5">
              <p className="text-sm font-semibold text-ink">Điểm nổi bật</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                {product.highlights.map((entry, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <SpecTable raw={product.raw} />

      {!previewMode ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-sm text-ink-soft">
          Xem thêm sản phẩm{" "}
          <Link href={`/tools/${tool.slug}`} className="font-medium text-brand-700 hover:underline">
            {tool.name}
          </Link>{" "}
          →
        </div>
      ) : null}
    </div>
  );
}

function SpecTable({ raw }: { raw: Record<string, unknown> }): React.ReactElement | null {
  const entries = Object.entries(raw).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "object") return false;
    return true;
  });
  if (entries.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="border-b border-line px-5 py-3">
        <p className="text-sm font-semibold text-ink">Thông số</p>
      </div>
      <dl className="divide-y divide-line">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">{prettifyKey(key)}</dt>
            <dd className="text-sm text-ink">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function prettifyKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return new Intl.NumberFormat("vi-VN").format(value);
  return String(value);
}

function buildProductJsonLd(
  product: ReturnType<typeof normalizeProduct>,
  toolName: string
): Record<string, unknown> {
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    priceCurrency: product.currency ?? "VND"
  };
  if (product.price !== undefined) offer.price = product.price;
  return {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    image: product.image ? [product.image] : undefined,
    category: toolName,
    offers: offer,
    aggregateRating:
      product.rating !== undefined && product.reviewCount
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount
          }
        : undefined
  };
}
