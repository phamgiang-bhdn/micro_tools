import type React from "react";
import { formatMoney, normalizeProduct } from "../../lib/format";
import type { ProductItem, ProductView } from "../../lib/types";
import { AffiliateCta } from "./affiliate-cta";

interface Props {
  products: ProductItem[];
}

/**
 * "Quick Picks" cho BUYING_GUIDE — chia sản phẩm thành 3 phân khúc giá:
 * tiết kiệm / tầm trung / cao cấp. Cho user xem đáp án nhanh ngay đầu bài.
 *
 * Nếu < 3 sản phẩm: hiển thị bất nhiêu có nhiêu.
 */
export function QuickPicks({ products: raw }: Props): React.ReactElement | null {
  if (raw.length === 0) return null;
  const products = raw.map((p) => ({ raw: p, view: normalizeProduct(p) }));

  // Sort by price ascending. Sản phẩm không có giá → đẩy cuối.
  const withPrice = products
    .filter((p) => p.view.price !== undefined)
    .sort((a, b) => (a.view.price ?? 0) - (b.view.price ?? 0));

  // Đủ 3 sản phẩm: chia tiết kiệm / tầm trung / cao cấp.
  // Ít hơn: hiển thị từng cái 1, không gán tier.
  const tiered = withPrice.length >= 3;
  const picks =
    tiered
      ? [
          { tier: "Tiết kiệm", subtitle: "Giá thấp nhất", ...withPrice[0] },
          {
            tier: "Tầm trung",
            subtitle: "Cân bằng giá & tính năng",
            ...withPrice[Math.floor(withPrice.length / 2)]
          },
          { tier: "Cao cấp", subtitle: "Tính năng full, không tiếc tiền", ...withPrice[withPrice.length - 1] }
        ]
      : products.slice(0, 3).map((p) => ({ tier: null, subtitle: null, ...p }));

  return (
    <aside className="not-prose my-8 rounded-3xl border border-line bg-card p-5 shadow-card sm:p-7">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-700">Quick Picks</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {tiered ? "Top lựa chọn theo phân khúc" : "Gợi ý nhanh"}
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {picks.map((pick) => (
          <PickCard key={pick.raw.id} pick={pick} />
        ))}
      </div>
    </aside>
  );
}

interface PickProps {
  pick: {
    tier: string | null;
    subtitle: string | null;
    raw: ProductItem;
    view: ProductView;
  };
}

function PickCard({ pick }: PickProps): React.ReactElement {
  const { tier, subtitle, raw, view } = pick;
  const tierColor =
    tier === "Tiết kiệm"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tier === "Tầm trung"
        ? "bg-sky-50 text-sky-700 ring-sky-200"
        : tier === "Cao cấp"
          ? "bg-violet-50 text-violet-700 ring-violet-200"
          : "bg-primary-50 text-primary-700 ring-primary-200";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-4 transition hover:border-primary-200 hover:bg-card">
      {tier ? (
        <div>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tierColor}`}>
            {tier}
          </span>
          {subtitle ? <p className="mt-1 text-[11px] text-ink-mute">{subtitle}</p> : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card">
        {view.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.image} alt={view.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center bg-gradient-to-br from-primary-50 to-accent-50 text-3xl font-bold text-primary-700">
            {view.brand?.[0] ?? "★"}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-1">
        {view.brand ? (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{view.brand}</p>
        ) : null}
        <p className="line-clamp-2 min-h-[2.6em] text-sm font-semibold text-ink">{view.name}</p>
      </div>

      {view.price !== undefined ? (
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-primary-700">{formatMoney(view.price, view.currency)}</span>
          {view.originalPrice && view.originalPrice > view.price ? (
            <span className="text-xs text-ink-mute line-through">{formatMoney(view.originalPrice, view.currency)}</span>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-ink-mute">Liên hệ shop</p>
      )}

      <AffiliateCta
        productId={raw.id}
        affiliateUrl={raw.affiliateUrl}
        size="sm"
        className="w-full justify-center"
        label="Xem deal"
        store={view.store}
      />
    </div>
  );
}
