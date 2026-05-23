import type React from "react";
import type { TopProductSnapshotItem } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { trackTopSnapshotRedirectAction } from "../../app/actions/tracking";

interface TopProductCardProps {
  product: TopProductSnapshotItem;
}

export function TopProductCard({ product }: TopProductCardProps): React.ReactElement {
  const discount = product.discount ? Number(product.discount) : null;
  return (
    <form action={trackTopSnapshotRedirectAction} className="contents">
      <input type="hidden" name="affiliateUrl" value={product.affLink} />
      <button
        type="submit"
        className="group block w-full rounded-xl border border-line bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
      >
        <div className="relative aspect-square overflow-hidden rounded-lg bg-canvas">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 size-full object-contain transition group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-ink-mute">—</div>
          )}
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            #{product.position}
          </span>
          {product.merchantDisplay || product.merchant ? (
            <span className="absolute right-2 top-2 max-w-[60%] truncate rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-mute ring-1 ring-line">
              {product.merchantDisplay ?? product.merchant}
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-2 text-sm font-medium text-ink">{product.name}</h3>
          {discount != null && discount > 0 ? (
            <p className="text-sm font-bold text-brand-700">{formatMoney(discount)}</p>
          ) : product.price ? (
            <p className="text-sm font-bold text-brand-700">{formatMoney(Number(product.price))}</p>
          ) : null}
          {product.brand ? (
            <p className="text-[11px] text-ink-mute">{product.brand}</p>
          ) : null}
        </div>
      </button>
    </form>
  );
}
