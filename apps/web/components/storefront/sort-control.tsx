import type React from "react";
import Link from "next/link";
import { Icon } from "../ui/icon";

export interface SortOption {
  value: string;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: "top", label: "Giảm nhiều nhất" },
  { value: "price-asc", label: "Giá thấp → cao" },
  { value: "price-desc", label: "Giá cao → thấp" },
  { value: "newest", label: "Mới về" },
  { value: "name", label: "Theo tên A-Z" }
];

interface SortControlProps {
  /** Current sort value. */
  sort: string;
  /** Function to build href for each option. */
  buildHref: (value: string) => string;
}

export function SortControl({ sort, buildHref }: SortControlProps): React.ReactElement {
  const current = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
  return (
    <details className="group relative">
      <summary className="inline-flex shrink-0 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
        <Icon name="sort" size="sm" />
        <span>{current.label}</span>
        <Icon name="chevron-down" size="xs" className="transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-card-lg">
        {SORT_OPTIONS.map((option) => {
          const active = option.value === sort;
          return (
            <Link
              key={option.value}
              href={buildHref(option.value)}
              scroll={false}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-canvas hover:text-ink"
              }`}
            >
              <span>{option.label}</span>
              {active ? <Icon name="check" size="md" className="text-brand-700" /> : null}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
