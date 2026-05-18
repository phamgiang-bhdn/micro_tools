import type React from "react";
import { cn } from "../../../lib/utils";
import { OverviewStats, type OverviewStat } from "./overview-stats";

/**
 * Layout chuẩn cho mọi list page trong /admin.
 *
 *   [Title + Actions]   (gọn, một dòng — không eyebrow / không subtitle)
 *   [OverviewStats]     (optional KPI cards)
 *   [Filter]            (FilterBar)
 *   [Table + Pagination]
 *
 * Eyebrow + subtitle đã bị bỏ để tiết kiệm diện tích — chỉ giữ title.
 * Props `eyebrow` / `subtitle` giữ cho backward compat nhưng **không render**.
 */
interface ListPageShellProps {
  /** @deprecated không còn render — giữ prop để khỏi vỡ callers. */
  eyebrow?: string;
  title: string;
  /** @deprecated không còn render — giữ prop để khỏi vỡ callers. */
  subtitle?: React.ReactNode;
  /** Buttons phía trên cùng (vd "+ Tạo coupon"). */
  actions?: React.ReactNode;

  /** KPI cards. Bỏ qua nếu page không có overview. */
  overview?: OverviewStat[];
  overviewCols?: 2 | 3 | 4 | 5;

  /** Filter slot — thường là <FilterBar>. */
  filter?: React.ReactNode;

  /** Table slot — thường là <DataTable> + <Pagination>. */
  table: React.ReactNode;

  /** Slot cuối cho nội dung phụ (vd panel lập tài liệu, hint…). */
  footer?: React.ReactNode;

  className?: string;
}

export function ListPageShell({
  title,
  actions,
  overview,
  overviewCols = 4,
  filter,
  table,
  footer,
  className
}: ListPageShellProps): React.ReactElement {
  return (
    <div className={cn("space-y-3", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-admin-ink">{title}</h1>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {overview && overview.length > 0 ? (
        <OverviewStats items={overview} cols={overviewCols} />
      ) : null}
      {filter ? <div>{filter}</div> : null}
      <div>{table}</div>
      {footer ? <div>{footer}</div> : null}
    </div>
  );
}
