import type React from "react";
import { PageHeader } from "./page-header";
import { OverviewStats, type OverviewStat } from "./overview-stats";
import { cn } from "../../../lib/utils";

/**
 * Layout chuẩn cho mọi list page trong /admin.
 *
 *   [PageHeader  (eyebrow + title + subtitle + actions)]
 *   [OverviewStats (optional KPI cards) ]
 *   [Filter      (slot — thường là <FilterBar>)]
 *   [Table + Pagination (slot — thường là <DataTable> + <Pagination>)]
 *
 * Đừng tạo layout list page riêng — extend file này nếu thiếu slot.
 */
interface ListPageShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Buttons phía trên cùng (vd "+ Tạo coupon"). */
  actions?: React.ReactNode;

  /** Optional: KPI cards. Bỏ qua nếu page không có overview. */
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
  eyebrow,
  title,
  subtitle,
  actions,
  overview,
  overviewCols = 4,
  filter,
  table,
  footer,
  className
}: ListPageShellProps): React.ReactElement {
  return (
    <div className={cn("space-y-5", className)}>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} />
      {overview && overview.length > 0 ? (
        <OverviewStats items={overview} cols={overviewCols} />
      ) : null}
      {filter ? <div>{filter}</div> : null}
      <div>{table}</div>
      {footer ? <div>{footer}</div> : null}
    </div>
  );
}
