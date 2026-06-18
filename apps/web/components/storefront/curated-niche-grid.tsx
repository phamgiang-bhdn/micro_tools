import type React from "react";
import Link from "next/link";
import type { CuratedNicheTile } from "../../lib/curated-niches";

interface Props {
  niches: CuratedNicheTile[];
}

/**
 * Grid 3 cột desktop / 2 cột mobile — 6 niche ưu tiên thay 100-chip row.
 * Fallback gradient + iconHint khi ảnh chưa có (operator upload sau qua STORY-04).
 */
export function CuratedNicheGrid({ niches }: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {niches.map((n) => (
        <Link
          key={n.slug}
          href={n.href}
          className="group relative flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-border transition hover:ring-primary-300 hover:shadow-card-md"
        >
          <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-canvas">
            <span
              aria-hidden
              className="absolute inset-0 grid place-items-center text-5xl opacity-90 transition group-hover:scale-110"
            >
              {n.iconHint}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-1 p-4">
            <p className="text-[15px] font-bold text-ink group-hover:text-primary-700">{n.displayName}</p>
            {n.productCount > 0 ? (
              <p className="text-xs font-medium text-ink-soft">{n.productCount} deal đang sống</p>
            ) : (
              <p className="text-xs text-ink-mute">Đang cập nhật</p>
            )}
            <p className="line-clamp-1 text-xs text-ink-mute">{n.pitch}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
