import type React from "react";
import Link from "next/link";
import { cn } from "../../../lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  total: number;
  pageSize: number;
}

export function Pagination({
  page,
  totalPages,
  buildHref,
  total,
  pageSize
}: PaginationProps): React.ReactElement | null {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-admin-line bg-admin-subtle/30 px-4 py-2.5 text-xs text-admin-mute">
        <span>
          Tổng: <span className="font-semibold text-admin-ink">{total.toLocaleString("vi-VN")}</span>
        </span>
      </div>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-line bg-admin-subtle/30 px-4 py-2.5 text-xs">
      <span className="text-admin-mute">
        Hiển thị <span className="font-semibold text-admin-ink">{from}–{to}</span> / {total.toLocaleString("vi-VN")}
      </span>
      <div className="flex items-center gap-1">
        <NavLink href={buildHref(Math.max(1, page - 1))} disabled={!canPrev} label="Trước" arrow="left" />
        <span className="px-2 font-mono text-admin-ink">
          {page} / {totalPages}
        </span>
        <NavLink href={buildHref(Math.min(totalPages, page + 1))} disabled={!canNext} label="Sau" arrow="right" />
      </div>
    </div>
  );
}

function NavLink({
  href,
  disabled,
  label,
  arrow
}: {
  href: string;
  disabled: boolean;
  label: string;
  arrow: "left" | "right";
}): React.ReactElement {
  const cls = cn(
    "inline-flex items-center gap-1 rounded-md border border-admin-line bg-admin-surface px-2.5 py-1 text-xs font-medium",
    disabled
      ? "cursor-not-allowed opacity-40"
      : "text-admin-ink hover:border-admin-accent hover:text-admin-accent"
  );
  if (disabled) {
    return (
      <span aria-disabled className={cls}>
        {arrow === "left" ? "←" : null}
        {label}
        {arrow === "right" ? "→" : null}
      </span>
    );
  }
  return (
    <Link href={href} className={cls}>
      {arrow === "left" ? "←" : null}
      {label}
      {arrow === "right" ? "→" : null}
    </Link>
  );
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): {
  items: T[];
  totalPages: number;
  safePage: number;
} {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), totalPages, safePage };
}
