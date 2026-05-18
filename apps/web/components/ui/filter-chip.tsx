import type React from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";

interface FilterChipProps {
  href: string;
  active?: boolean;
  label: React.ReactNode;
  /** Số đếm nhỏ bên phải (vd. số sản phẩm trong niche). */
  count?: number;
  /** Scroll lên đầu khi navigate (default: false để filter trên trang giữ vị trí). */
  scroll?: boolean;
  className?: string;
}

/**
 * Chip filter dùng cho mọi danh sách (home category filter, blog filter, ...).
 * Active state: nền đen, chữ trắng. Inactive: outline có hover brand.
 */
export function FilterChip({
  href,
  active = false,
  label,
  count,
  scroll = false,
  className
}: FilterChipProps): React.ReactElement {
  return (
    <Link
      href={href}
      scroll={scroll}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "bg-ink text-white shadow-card"
          : "border border-line bg-card text-ink-soft hover:border-brand-300 hover:text-brand-700",
        className
      )}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span className={cn("text-xs", active ? "text-white/70" : "text-ink-mute")}>{count}</span>
      ) : null}
    </Link>
  );
}

interface FilterChipRowProps {
  /** Aria label cho nav landmark. */
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Trailing slot (vd. sort control). */
  trailing?: React.ReactNode;
}

export function FilterChipRow({
  label,
  children,
  className,
  trailing
}: FilterChipRowProps): React.ReactElement {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <nav
        aria-label={label}
        className="scrollbar-thin -mx-1 flex flex-1 gap-2 overflow-x-auto px-1"
      >
        {children}
      </nav>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
