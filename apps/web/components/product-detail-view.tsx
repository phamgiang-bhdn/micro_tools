import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney, formatNumber, normalizeProduct } from "../lib/format";
import { createTrackingRedirect } from "../app/actions/tracking";
import { Breadcrumb } from "./ui/breadcrumb";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { ProductItem } from "../lib/types";

interface RelatedItem {
  id: string;
  slug?: string | null;
  name: string;
  image?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  discountPercent?: number;
  store?: string;
}

interface ProductDetailViewProps {
  productRaw: ProductItem;
  category: { name: string; slug: string };
  previewMode?: boolean;
  related?: RelatedItem[];
}

/**
 * Trang chi tiết sản phẩm.
 * UX nâng cấp:
 * - Savings amount + % được nhấn mạnh ngay trên price card.
 * - CTA "Mua ngay" sticky ở mobile để không bao giờ mất khỏi viewport.
 * - Trust strip (cập nhật giờ, redirect bảo mật, affiliate minh bạch) ngay dưới CTA.
 * - Related products để user không cần back lại category.
 */
export function ProductDetailView({
  productRaw,
  category,
  previewMode = false,
  related = []
}: ProductDetailViewProps): React.ReactElement {
  const product = normalizeProduct(productRaw);
  const jsonLd = buildProductJsonLd(product, category.name);
  const savings =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? product.originalPrice - product.price
      : undefined;

  const buyAction = async (): Promise<void> => {
    "use server";
    const tracked = await createTrackingRedirect({
      productId: product.id,
      affiliateUrl: productRaw.affiliateUrl
    });
    redirect(tracked.finalUrl);
  };

  return (
    <div className="space-y-8 pb-24 lg:pb-0">
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
          { label: category.name, href: previewMode ? "/admin?tab=refinery" : `/categories/${category.slug}` },
          { label: product.name }
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-3xl border border-line bg-card shadow-card animate-fade-up">
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
                <Badge tone="brand" size="md" className="text-sm font-bold shadow-glow-sm">
                  -{product.discountPercent}%
                </Badge>
              ) : null}
              {product.badge ? <Badge tone="ink" size="md">{product.badge}</Badge> : null}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-5 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div>
            {product.brand ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">{product.brand}</p>
            ) : null}
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              {product.rating !== undefined ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="text-amber-500">{"★".repeat(Math.round(product.rating))}</span>
                  <span className="font-medium text-ink">{product.rating.toFixed(1)}</span>
                  {product.reviewCount ? (
                    <span className="text-ink-mute">({formatNumber(product.reviewCount)} đánh giá)</span>
                  ) : null}
                </span>
              ) : null}
              {product.store ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-2.5 py-0.5 text-xs">
                  <StoreIcon /> {product.store}
                </span>
              ) : null}
            </div>
          </div>

          {/* PRICE CARD — nhấn vào tiết kiệm */}
          <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-white to-canvas p-5 shadow-card">
            {product.price !== undefined ? (
              <>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-bold text-brand-700 sm:text-4xl">
                    {formatMoney(product.price, product.currency)}
                  </span>
                  {product.originalPrice && product.originalPrice > product.price ? (
                    <span className="text-base text-ink-mute line-through">
                      {formatMoney(product.originalPrice, product.currency)}
                    </span>
                  ) : null}
                </div>
                {savings ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-700 ring-1 ring-inset ring-accent-200">
                    <SavingsIcon />
                    Tiết kiệm {formatMoney(savings, product.currency)}
                    {product.discountPercent ? <span className="text-accent-600">· -{product.discountPercent}%</span> : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-base font-medium text-ink-soft">Liên hệ shop</p>
            )}
          </div>

          {/* CTA */}
          {previewMode ? (
            <div>
              <Button type="button" variant="brand" size="lg" className="w-full cursor-not-allowed opacity-60 sm:w-auto" disabled>
                Mua ngay → (khoá ở preview)
              </Button>
              <p className="mt-2 text-xs text-ink-mute">Approve qua Refinery để bật click tracking thật.</p>
            </div>
          ) : (
            <form action={buyAction} className="space-y-2">
              <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto">
                Mua ngay tại {product.store ?? "shop"} →
              </Button>
              <p className="text-xs text-ink-mute">
                Bạn sẽ được chuyển sang website của {product.store ?? "shop"} để hoàn tất đơn hàng.
              </p>
            </form>
          )}

          {/* Trust strip */}
          <TrustStrip />

          {product.highlights && product.highlights.length > 0 ? (
            <div className="rounded-2xl border border-line bg-card p-5">
              <p className="text-sm font-semibold text-ink">Điểm nổi bật</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                {product.highlights.map((entry, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-accent-100 text-accent-700">
                      <CheckSmall />
                    </span>
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <DescriptionSection description={product.description} />

      <SpecTable raw={product.raw} />

      {related.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Sản phẩm liên quan trong {category.name}</h2>
            <Link href={`/categories/${category.slug}`} className="text-sm font-medium text-brand-700 hover:underline">
              Xem tất cả →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/categories/${category.slug}/${r.slug ?? r.id}`}
                className="group overflow-hidden rounded-xl border border-line bg-card shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-md"
              >
                <div className="relative aspect-square overflow-hidden bg-canvas">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt={r.name} loading="lazy" className="size-full object-cover transition group-hover:scale-110" />
                  ) : (
                    <div className="grid size-full place-items-center bg-gradient-to-br from-brand-50 via-white to-accent-50 text-base font-bold text-brand-700">
                      {r.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {r.discountPercent ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      -{r.discountPercent}%
                    </span>
                  ) : null}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-medium text-ink group-hover:text-brand-700">{r.name}</p>
                  {r.price !== undefined ? (
                    <p className="mt-1 text-xs font-bold text-brand-700">{formatMoney(r.price, r.currency)}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* STICKY MOBILE CTA */}
      {!previewMode ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <form action={buyAction} className="flex items-center gap-3">
            {product.price !== undefined ? (
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-base font-bold text-brand-700">{formatMoney(product.price, product.currency)}</span>
                {savings ? (
                  <span className="text-[11px] font-medium text-accent-700">
                    Tiết kiệm {formatMoney(savings, product.currency)}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex-1 text-sm text-ink-soft">Liên hệ shop</div>
            )}
            <Button type="submit" variant="brand" size="md">
              Mua ngay →
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function TrustStrip(): React.ReactElement {
  const items: Array<{ icon: React.ReactNode; title: string; desc: string }> = [
    {
      icon: <ClockIcon />,
      title: "Cập nhật mỗi giờ",
      desc: "Giá & tồn kho theo thời gian thực"
    },
    {
      icon: <ShieldIcon />,
      title: "Chuyển hướng an toàn",
      desc: "Tracking qua link đối tác chính thức"
    },
    {
      icon: <TagIcon />,
      title: "Affiliate minh bạch",
      desc: "Giá không thay đổi cho người mua"
    }
  ];
  return (
    <div className="grid grid-cols-1 gap-2 rounded-2xl border border-line bg-card p-4 sm:grid-cols-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-700">
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink">{item.title}</p>
            <p className="text-[11px] leading-relaxed text-ink-mute">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DescriptionSection({ description }: { description?: string }): React.ReactElement | null {
  if (!description) return null;
  const blocks = parseDescriptionBlocks(description);
  if (blocks.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="border-b border-line bg-canvas/70 px-5 py-3">
        <p className="text-sm font-semibold text-ink">Mô tả sản phẩm</p>
      </div>
      <div className="space-y-3 px-5 py-4 [overflow-wrap:anywhere]">
        {blocks.map((block, idx) => {
          if (block.kind === "heading") {
            return (
              <h3 key={idx} className="pt-1 text-sm font-semibold text-ink">
                {block.text}
              </h3>
            );
          }
          if (block.kind === "list") {
            return (
              <ul key={idx} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={idx} className="text-sm leading-relaxed text-ink-soft">
              {block.text}
            </p>
          );
        })}
      </div>
    </section>
  );
}

type DescBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] };

function parseDescriptionBlocks(raw: string): DescBlock[] {
  const normalized = raw.replace(/\r\n/g, "\n");
  // AT descriptions thường dùng 2+ space giữa các câu/đoạn (không có \n) làm separator.
  const chunks = normalized
    .split(/\n+|\s{2,}/g)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const blocks: DescBlock[] = [];
  let listBuffer: string[] = [];

  const flushList = (): void => {
    if (listBuffer.length > 0) {
      blocks.push({ kind: "list", items: listBuffer });
      listBuffer = [];
    }
  };

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const bulletMatch = chunk.match(/^[-•·*]\s+(.+)$/);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1].trim());
      continue;
    }
    flushList();
    const isShortColonHeading = chunk.length <= 60 && /:$/.test(chunk);
    const next = chunks[i + 1];
    const isLeadIntoList =
      chunk.length <= 60 && next !== undefined && /^[-•·*]\s+/.test(next);
    if (isShortColonHeading || isLeadIntoList) {
      blocks.push({ kind: "heading", text: chunk.replace(/:$/, "") });
    } else {
      blocks.push({ kind: "paragraph", text: chunk });
    }
  }
  flushList();
  return blocks;
}

const SPEC_TABLE_DENYLIST = new Set([
  // already shown elsewhere in the page
  "description",
  "image",
  "imageUrl",
  "thumbnail",
  "photo",
  "name",
  "brand",
  "price",
  "originalPrice",
  "salePrice",
  "currentPrice",
  "listPrice",
  "msrp",
  "regularPrice",
  "currency",
  "discount",
  "discountPercent",
  "discountRate",
  "discountAmount",
  "rating",
  "stars",
  "score",
  "reviewCount",
  "reviews",
  "ratingCount",
  "badge",
  "tag",
  "label",
  "highlights",
  "features",
  "perks",
  "benefits",
  // source / internal context — không thuộc "thông số sản phẩm"
  "store",
  "shop",
  "merchant",
  "seller",
  "network",
  "campaign",
  "sourceId",
  "sourceNetwork",
  "sourceProductId",
  "sku",
  "atCategorySlug",
  "category",
  "type",
  "updateTime",
  "statusDiscount",
  "promotion",
  "metadata"
]);

function SpecTable({ raw }: { raw: Record<string, unknown> }): React.ReactElement | null {
  const entries = Object.entries(raw).filter(([key, value]) => {
    if (SPEC_TABLE_DENYLIST.has(key)) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === "object") return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    return true;
  });
  if (entries.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="border-b border-line bg-canvas/70 px-5 py-3">
        <p className="text-sm font-semibold text-ink">Thông số chi tiết</p>
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
  categoryName: string
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
    category: categoryName,
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

function SavingsIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M20 12V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
      <path d="M21 13.5h-4a2.5 2.5 0 0 1 0-5h4Z" />
    </svg>
  );
}

function StoreIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="M3 9h18l-1.5-5h-15Z" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function ClockIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ShieldIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function TagIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </svg>
  );
}

function CheckSmall(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="size-2.5">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}
