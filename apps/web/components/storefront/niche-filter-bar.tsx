import type React from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { SortControl } from "./sort-control";

export interface PriceTier {
  /** URL-safe key (vd "10-15tr"). */
  key: string;
  label: string;
  /** Min VND (inclusive). undefined = không giới hạn dưới. */
  min?: number;
  /** Max VND (exclusive). undefined = không giới hạn trên. */
  max?: number;
}

/**
 * Default price tiers cho hầu hết niche tiêu dùng VN. Component caller có thể truyền
 * custom (vd skincare, đồng hồ cơ có range khác).
 */
export const DEFAULT_PRICE_TIERS: PriceTier[] = [
  { key: "u-3tr", label: "Dưới 3tr", max: 3_000_000 },
  { key: "3-7tr", label: "3-7tr", min: 3_000_000, max: 7_000_000 },
  { key: "7-15tr", label: "7-15tr", min: 7_000_000, max: 15_000_000 },
  { key: "15-25tr", label: "15-25tr", min: 15_000_000, max: 25_000_000 },
  { key: "25tr+", label: "Trên 25tr", min: 25_000_000 }
];

interface Props {
  nicheSlug: string;
  /** Current URL state. */
  activePrice?: string;
  activeStore?: string;
  sort: string;
  /** Store options derived từ products có trong niche này. */
  storeOptions: string[];
  /** Override default price tiers per niche nếu cần. */
  priceTiers?: PriceTier[];
}

export function NicheFilterBar({
  nicheSlug,
  activePrice,
  activeStore,
  sort,
  storeOptions,
  priceTiers = DEFAULT_PRICE_TIERS
}: Props): React.ReactElement {
  const buildHref = (next: Partial<{ price?: string; store?: string; sort: string }>): string => {
    const params = new URLSearchParams();
    const price = "price" in next ? next.price : activePrice;
    const store = "store" in next ? next.store : activeStore;
    const sortValue = next.sort ?? sort;
    if (price) params.set("price", price);
    if (store) params.set("store", store);
    if (sortValue && sortValue !== "top") params.set("sort", sortValue);
    const qs = params.toString();
    return qs ? `/categories/${nicheSlug}?${qs}` : `/categories/${nicheSlug}`;
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card/85 p-3 shadow-sm backdrop-blur sm:p-4">
      <FilterChipRow
        label="Khoảng giá"
        items={[
          { key: undefined, label: "Tất cả" },
          ...priceTiers.map((t) => ({ key: t.key, label: t.label }))
        ]}
        activeKey={activePrice}
        buildHref={(k) => buildHref({ price: k })}
      />

      {storeOptions.length > 0 ? (
        <FilterChipRow
          label="Cửa hàng"
          items={[
            { key: undefined, label: "Tất cả" },
            ...storeOptions.map((s) => ({ key: s, label: s }))
          ]}
          activeKey={activeStore}
          buildHref={(k) => buildHref({ store: k })}
        />
      ) : null}

      <div className="flex items-center justify-end pt-1">
        <SortControl sort={sort} buildHref={(v) => buildHref({ sort: v })} />
      </div>
    </div>
  );
}

function FilterChipRow({
  label,
  items,
  activeKey,
  buildHref
}: {
  label: string;
  items: Array<{ key: string | undefined; label: string }>;
  activeKey?: string;
  buildHref: (k: string | undefined) => string;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-mute">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const active = (it.key ?? "") === (activeKey ?? "");
          return (
            <Link
              key={it.key ?? "all"}
              href={buildHref(it.key)}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium transition",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-line bg-card text-ink-soft hover:border-brand-300 hover:text-brand-700"
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Server-side filter helper — caller dùng để filter products array trước khi render.
 * Trả lại products đã filter theo price tier + store. KHÔNG sort (caller tự sort).
 */
export function applyNicheFilters<T extends { price?: number; store?: string }>(
  products: T[],
  filters: { price?: string; store?: string },
  priceTiers: PriceTier[] = DEFAULT_PRICE_TIERS
): T[] {
  let result = products;
  if (filters.price) {
    const tier = priceTiers.find((t) => t.key === filters.price);
    if (tier) {
      result = result.filter((p) => {
        if (typeof p.price !== "number") return false;
        if (tier.min !== undefined && p.price < tier.min) return false;
        if (tier.max !== undefined && p.price >= tier.max) return false;
        return true;
      });
    }
  }
  if (filters.store) {
    const needle = filters.store.toLowerCase();
    result = result.filter((p) => Boolean(p.store && p.store.toLowerCase().includes(needle)));
  }
  return result;
}
