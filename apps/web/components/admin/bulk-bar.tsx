"use client";

import * as React from "react";
import { AdminButton } from "./ui";

export interface BulkAction {
  value: string;
  label: string;
  /** Hiện trong `window.confirm` trước khi apply. Để rỗng = không hỏi (caller tự xử lý confirm). */
  confirm: string;
  tone?: "default" | "danger";
}

interface BulkBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  action: string;
  setAction: (v: string) => void;
  onApply: () => void;
  pending: boolean;
  /** Slot bên phải — thường là nút "Tạo mới" hoặc tương tự. */
  rightSlot?: React.ReactNode;
  /** Slot phụ giữa select + nút (vd: secondary select cho action `assign-category`). */
  extraSlot?: React.ReactNode;
}

/**
 * Bulk action bar — counter + select hành động + nút Áp dụng.
 * Dùng chung cho mọi bảng admin có bulk select.
 */
export function BulkBar({
  selectedCount,
  totalCount,
  actions,
  action,
  setAction,
  onApply,
  pending,
  rightSlot,
  extraSlot
}: BulkBarProps): React.ReactElement {
  const current = actions.find((a) => a.value === action);
  const danger = current?.tone === "danger";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/40 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] text-admin-mute">
          Đã chọn:{" "}
          <span className="font-semibold text-admin-ink">{selectedCount}</span> / {totalCount}
        </span>
        {selectedCount > 0 ? (
          <>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="h-8 rounded-md border border-admin-line bg-admin-surface px-2 pr-7 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
            >
              <option value="">Chọn hành động</option>
              {actions.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            {extraSlot}
            <AdminButton
              size="sm"
              variant={danger ? "danger" : "primary"}
              loading={pending}
              disabled={!action}
              onClick={onApply}
            >
              Áp dụng
            </AdminButton>
          </>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
}

/**
 * Tiện ích build ColumnDef cell + header cho cột chọn — gọi từ table component.
 * Returns `{ headerCheckbox, rowCheckbox }`.
 */
export function selectionColumnRenderers<T extends { id: string }>(args: {
  allSelected: boolean;
  toggleAll: (checked: boolean) => void;
  isSelected: (id: string) => boolean;
  toggleOne: (id: string, checked: boolean) => void;
  rowLabel?: (row: T) => string;
}): {
  header: React.ReactElement;
  cell: (row: T) => React.ReactElement;
} {
  return {
    header: (
      <input
        type="checkbox"
        aria-label="Chọn tất cả"
        checked={args.allSelected}
        onChange={(e) => args.toggleAll(e.currentTarget.checked)}
        className="size-4 rounded border-admin-line text-admin-accent"
      />
    ),
    cell: (row) => (
      <input
        type="checkbox"
        aria-label={args.rowLabel ? `Chọn ${args.rowLabel(row)}` : `Chọn dòng ${row.id}`}
        checked={args.isSelected(row.id)}
        onChange={(e) => args.toggleOne(row.id, e.currentTarget.checked)}
        className="size-4 rounded border-admin-line text-admin-accent"
      />
    )
  };
}

/**
 * Confirm + apply helper — chạy `window.confirm` (nếu action có `confirm` string),
 * gọi `apply()` (FormData-based), kết thúc bằng `router.refresh()` ở caller.
 * Caller chịu trách nhiệm setSelected, setAction, setPending.
 */
export function buildBulkConfirmMessage(cfg: BulkAction | undefined, count: number): string | null {
  if (!cfg || !cfg.confirm) return null;
  return `${cfg.confirm}\n\nÁp dụng cho ${count} mục.`;
}
