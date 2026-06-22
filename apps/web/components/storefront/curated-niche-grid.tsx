import type React from "react";
import Link from "next/link";
import type { CuratedNicheTile } from "../../lib/curated-niches";

interface Props {
  niches: CuratedNicheTile[];
}

/**
 * Hàng chip gọn "khám phá theo danh mục" — 6 niche ưu tiên.
 * Mỗi chip: icon Lucide trong vòng tròn + tên + count/trạng thái. Đồng bộ với thanh lọc
 * danh mục bên dưới (thay card to có vùng ảnh trống). Link theo trạng thái niche.
 */
export function CuratedNicheGrid({ niches }: Props): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2.5">
      {niches.map((n) => (
        <Link
          key={n.slug}
          href={n.href}
          className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-4 shadow-card transition hover:border-primary-300 hover:shadow-card-md"
        >
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-600 transition group-hover:bg-primary-100"
          >
            <n.Icon className="size-[18px]" strokeWidth={1.9} />
          </span>
          <span className="flex flex-col pr-1 leading-tight">
            <span className="text-body-sm font-semibold text-ink group-hover:text-primary-700">
              {n.displayName}
            </span>
            <span className="text-micro font-medium text-ink-mute">
              {n.productCount > 0 ? `${n.productCount} deal đang sống` : "Sắp lên kệ"}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
