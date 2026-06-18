import type React from "react";
import { Star } from "lucide-react";
import { formatStoreBadge } from "../../lib/store-tier";
import { cn } from "../../lib/utils";

interface Props {
  store?: string | null;
  /** Default đặt absolute top-right; pass `inline` để render inline trong meta row. */
  position?: "absolute" | "inline";
  size?: "xs" | "sm";
}

/**
 * Badge tier shop trên ProductCard. Mall tier (Lazada Mall / Shopee Mall / Tiki Trading)
 * highlight bằng icon Star vàng — tín hiệu trust mạnh nhất với user VN.
 */
export function StoreTierBadge({ store, position = "absolute", size = "xs" }: Props): React.ReactElement | null {
  const badge = formatStoreBadge(store);
  if (!badge) return null;

  const base =
    "inline-flex items-center gap-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm";
  const sizeClass = size === "xs" ? "px-1.5 py-0.5 text-[0.594rem]" : "px-2 py-0.5 text-[0.656rem]";
  const positionClass =
    position === "absolute"
      ? "absolute right-2 top-2 max-w-[60%] truncate"
      : "";

  return (
    <span className={cn(base, sizeClass, positionClass, badge.toneClass)}>
      {badge.tier === "mall" ? <Star className="size-3 fill-current" aria-hidden /> : null}
      <span className="truncate">{badge.label}</span>
    </span>
  );
}
