import type React from "react";
import Link from "next/link";
import { trackAndRedirectAction } from "../../app/actions/tracking";
import { formatMoney } from "../../lib/format";
import { formatSpecLabel, formatSpecValue, pickComparisonColumns } from "../../lib/niche-seo";
import { slugify } from "../../lib/slug";
import type { ProductView } from "../../lib/types";

interface Props {
  products: Array<ProductView & { slug?: string | null; nicheSlug: string }>;
  schemaConfig: Record<string, unknown> | null | undefined;
  maxRows?: number;
}

/**
 * Bảng so sánh top N product theo % giảm. Column được auto-pick từ
 * `Niche.schemaConfig` — chỉ giữ key có data ≥3 row (skip column sparse).
 *
 * Mobile: scroll-x với sticky-first-column "Sản phẩm". Cell "Mua" là inline form
 * action tracking → outbound, không phải Link → giữ attribution parity với ProductCard.
 */
export function NicheComparisonTable({
  products,
  schemaConfig,
  maxRows = 5
}: Props): React.ReactElement | null {
  const rows = products.slice(0, maxRows);
  if (rows.length === 0) return null;

  const rawRows = rows.map((p) => p.raw);
  const specColumns = pickComparisonColumns(schemaConfig, rawRows, 5);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-card">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="bg-canvas text-[11.5px] uppercase tracking-wider text-ink-mute">
          <tr className="border-b border-line">
            <th scope="col" className="sticky left-0 z-10 bg-canvas px-3 py-2.5 text-left font-semibold">
              Sản phẩm
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Giá</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Giảm</th>
            {specColumns.map((key) => (
              <th key={key} scope="col" className="px-3 py-2.5 text-left font-semibold">
                {formatSpecLabel(key)}
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Mua</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((product) => {
            const detailKey =
              product.slug && product.slug.length > 0 ? product.slug : slugify(product.name) || product.id;
            const detailHref = `/categories/${product.nicheSlug}/${detailKey}`;
            return (
              <tr key={product.id} className="border-b border-line last:border-b-0 hover:bg-canvas/60">
                <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-3 text-left font-medium">
                  <Link href={detailHref} className="flex items-center gap-2.5 ring-focus">
                    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-brand-700">
                          {product.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 max-w-[200px] text-[13px] font-medium text-ink hover:text-brand-700">
                      {product.name}
                    </span>
                  </Link>
                </th>
                <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-brand-700">
                  {typeof product.price === "number" && product.price > 0
                    ? formatMoney(product.price, product.currency)
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {typeof product.discountPercent === "number" && product.discountPercent > 0 ? (
                    <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                      -{product.discountPercent}%
                    </span>
                  ) : (
                    <span className="text-ink-mute">—</span>
                  )}
                </td>
                {specColumns.map((key) => (
                  <td key={key} className="whitespace-nowrap px-3 py-3 text-ink-soft">
                    {formatSpecValue(product.raw[key], key)}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">
                  {product.affiliateUrl ? (
                    <form action={trackAndRedirectAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="affiliateUrl" value={product.affiliateUrl} />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700 ring-focus"
                      >
                        Mua ↗
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={detailHref}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
                    >
                      Xem
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
