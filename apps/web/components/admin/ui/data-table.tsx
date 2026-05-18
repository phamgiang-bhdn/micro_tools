import type React from "react";
import { cn } from "../../../lib/utils";

/**
 * DataTable chuẩn admin. Quy tắc trình bày:
 *
 * - Mặc định **mọi cell `whitespace-nowrap`** — không tự xuống dòng. Khi cần xuống dòng
 *   (cột mô tả dài), set `wrap: true` trên column. Logic: bảng admin info-dense, scroll
 *   ngang là chấp nhận được; wrap mọi cell làm hàng cao thấp lung tung rất xấu.
 * - Sticky header → giữ context khi scroll dọc trong dialog hoặc page dài.
 * - Hover row có màu nhẹ + transition; row đang chọn (selected) có background accent-soft.
 * - Cột actions (right-aligned) tự thêm padding-right thoáng hơn để icon không sát mép.
 *
 * Khi cần wrap thực sự cho 1 cell cụ thể (vd "lý do reject" 200 ký tự), set `wrap: true`
 * trên column đó; không tự ghi `whitespace-normal` trong cell renderer.
 */
export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  /** Chiều rộng cố định, nếu set → cell overflow-hidden + truncate. */
  width?: string;
  /** Chiều rộng tối đa (mặc định mọi cột text trong admin = 240px). */
  maxWidth?: string;
  className?: string;
  hideOnMobile?: boolean;
  /** Cho phép cell tự wrap. Mặc định false (truncate + tooltip). */
  wrap?: boolean;
  /** Bỏ truncate cho cột (vd action column). */
  noTruncate?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  caption?: React.ReactNode;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Hightlight 1 hoặc nhiều hàng (vd row vừa được chọn / vừa update). */
  isRowHighlighted?: (row: T) => boolean;
  /** Bỏ sticky header (vd table ngắn nhúng trong dialog). */
  noStickyHeader?: boolean;
  /** Bật zebra rows. Mặc định off để tránh quá ồn — bật khi nhiều cột số. */
  zebra?: boolean;
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
  toolbar,
  onRowClick,
  isRowHighlighted,
  noStickyHeader,
  zebra
}: DataTableProps<T>): React.ReactElement {
  return (
    <div className="admin-card overflow-hidden p-0">
      {toolbar || caption ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/40 px-4 py-2.5">
          {caption ? <div className="text-xs text-admin-mute">{caption}</div> : <div />}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}
      <div className="w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-admin-line text-[13.5px]">
          <thead
            className={cn(
              "bg-admin-subtle/70 backdrop-blur-sm",
              !noStickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-admin-mute">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5",
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
          <tbody className="divide-y divide-admin-line/70">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-14 text-center text-sm text-admin-mute"
                >
                  {emptyState ?? "Không có dữ liệu."}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const highlighted = isRowHighlighted?.(row);
                const clickable = Boolean(onRowClick);
                return (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors",
                      zebra && idx % 2 === 1 ? "bg-admin-subtle/25" : null,
                      highlighted
                        ? "bg-admin-accent-soft/60 hover:bg-admin-accent-soft"
                        : "hover:bg-admin-subtle/55",
                      clickable ? "cursor-pointer" : null
                    )}
                  >
                    {columns.map((c) => {
                      const truncate = !c.wrap && !c.noTruncate;
                      const inlineStyle: React.CSSProperties = {};
                      if (c.width) inlineStyle.width = c.width;
                      if (c.maxWidth) inlineStyle.maxWidth = c.maxWidth;
                      else if (truncate) inlineStyle.maxWidth = "240px";
                      const cellContent = c.cell(row);
                      const titleAttr =
                        truncate && typeof cellContent === "string" ? cellContent : undefined;
                      return (
                        <td
                          key={c.key}
                          title={titleAttr}
                          className={cn(
                            "px-4 py-2.5 align-middle text-admin-ink",
                            c.wrap
                              ? "whitespace-normal"
                              : truncate
                                ? "max-w-[240px] truncate"
                                : "whitespace-nowrap",
                            c.align ? ALIGN[c.align] : null,
                            c.hideOnMobile ? "hidden md:table-cell" : null,
                            c.className
                          )}
                          style={Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined}
                        >
                          {c.cell(row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
