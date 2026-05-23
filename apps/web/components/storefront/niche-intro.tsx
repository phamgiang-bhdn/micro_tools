import type React from "react";
import { autoIntro } from "../../lib/niche-seo";
import { formatRelativeShort } from "../../lib/format";

interface Props {
  niche: { name: string; slug: string; seoDescription?: string | null };
  productCount: number;
  lastUpdatedAt?: string | null;
  topDiscount: number;
}

/**
 * 2-3 dòng lead-in dưới H1. Ưu tiên `Niche.seoDescription` admin nhập tay; fallback
 * auto-gen từ count + topDiscount + lastUpdatedAt. Mục tiêu: cho user landing biết
 * ngay context (count + freshness + giá trị deal) thay vì scroll thẳng vào grid.
 */
export function NicheIntro({
  niche,
  productCount,
  lastUpdatedAt,
  topDiscount
}: Props): React.ReactElement {
  const intro =
    niche.seoDescription && niche.seoDescription.trim().length > 0
      ? niche.seoDescription.trim()
      : autoIntro(niche, productCount, formatRelativeShort(lastUpdatedAt), topDiscount);

  return (
    <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-soft sm:text-[15px]">
      {intro}
    </p>
  );
}
