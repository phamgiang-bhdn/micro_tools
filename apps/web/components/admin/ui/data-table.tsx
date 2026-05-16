import type React from "react";
import { cn } from "../../../lib/utils";

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  caption?: React.ReactNode;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

const ALIGN: Record<NonNullable<ColumnDef<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center"
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyState,
  caption,
  toolbar
}: DataTableProps<T>): React.ReactElement {
  return (
    <div className="admin-card overflow-hidden p-0">
      {toolbar || caption ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/30 px-4 py-3">
          {caption ? <div className="text-xs text-admin-mute">{caption}</div> : <div />}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}
      <div className="w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-admin-line text-sm">
          <thead className="bg-admin-subtle/50">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3",
                    c.align ? ALIGN[c.align] : null,
                    c.hideOnMobile ? "hidden md:table-cell" : null,
                    c.className
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-admin-mute">
                  {emptyState ?? "Không có dữ liệu."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="transition hover:bg-admin-subtle/40">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-3 align-middle",
                        c.align ? ALIGN[c.align] : null,
                        c.hideOnMobile ? "hidden md:table-cell" : null,
                        c.className
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
