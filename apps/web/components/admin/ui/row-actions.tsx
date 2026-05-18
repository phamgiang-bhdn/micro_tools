"use client";

import * as React from "react";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconButton } from "./icon-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "./dropdown-menu";
import { useConfirm } from "./confirm-dialog";
import { cn } from "../../../lib/utils";
import { notifyError, notifySuccess } from "../../../lib/admin/notify";

/**
 * Chuẩn hoá action ở mỗi hàng list page.
 *
 * Quy ước cứng:
 *  - **View** (xem chi tiết): icon Eye, render ngoài nếu có `onView`/`viewHref`.
 *  - **Edit**: icon Pencil, render ngoài nếu có `onEdit`/`editHref`.
 *  - **Custom actions** (publish, sync, retry…): truyền qua `more`.
 *    - Khi `more.length ≤ 2` → render inline icon ngoài.
 *    - Khi `more.length > 2` → gom vào dropdown ⋯ (item phải có icon để inline đẹp).
 *  - **Delete**: luôn icon Trash, **cuối cùng + có divider tách biệt** để tránh nhấn nhầm.
 *
 * Dùng:
 *   <RowActions
 *     onView={() => setViewing(row)}
 *     onEdit={() => setEditing(row)}
 *     onDelete={() => deleteAction({ id: row.id })}
 *     deleteConfirm="Xoá mã 'SUMMER25'?"
 *     more={[
 *       { label: "Đồng bộ", icon: <RefreshCw />, onSelect: () => syncAction(row.id) }
 *     ]}
 *   />
 */
export interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  /** Vô hiệu (xám) — vẫn hiển thị nhưng không click được. */
  disabled?: boolean;
  /** Nhãn "danger" → text màu đỏ trong menu. */
  tone?: "default" | "danger";
  /** Required: hàm chạy khi chọn item. Có thể async. */
  onSelect: () => void | Promise<void>;
  /** Phím tắt hiển thị bên phải (chỉ là text, RowActions không bind handler). */
  shortcut?: string;
  /** Hỏi confirm trước khi chạy. Truyền text confirm. */
  confirm?: string;
}

interface RowActionsProps {
  /** Xem chi tiết: handler hoặc link → render icon Eye ngoài. */
  onView?: () => void;
  viewHref?: string;
  viewLabel?: string;
  viewDisabled?: boolean;
  viewDisabledReason?: string;

  /** Sửa: link hoặc handler. Truyền `href` để render <Link>, hoặc `onEdit` để gọi handler. */
  onEdit?: () => void;
  editHref?: string;
  editLabel?: string;
  editDisabled?: boolean;
  editDisabledReason?: string;

  onDelete?: () => void | Promise<void>;
  deleteConfirm?: string;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;

  /**
   * Actions phụ. ≤2 item → render inline icon ngoài. >2 → gom vào ⋯ dropdown.
   * Khi inline, `icon` bắt buộc; item disabled hiện xám.
   */
  more?: RowActionItem[];

  /** Số item tối đa render inline trước khi rơi xuống dropdown. Default 2. */
  inlineThreshold?: number;

  className?: string;
}

export function RowActions({
  onView,
  viewHref,
  viewLabel = "Xem chi tiết",
  viewDisabled,
  viewDisabledReason,
  onEdit,
  editHref,
  editLabel = "Sửa",
  editDisabled,
  editDisabledReason,
  onDelete,
  deleteConfirm,
  deleteLabel = "Xoá",
  deleteDisabled,
  deleteDisabledReason,
  more,
  inlineThreshold = 2,
  className
}: RowActionsProps): React.ReactElement {
  const confirm = useConfirm();
  const handleDelete = React.useCallback(async () => {
    if (!onDelete) return;
    if (deleteConfirm) {
      const ok = await confirm({
        title: "Xác nhận xoá",
        message: deleteConfirm,
        tone: "danger",
        confirmLabel: "Xoá"
      });
      if (!ok) return;
    }
    try {
      await onDelete();
      notifySuccess("Đã xoá");
    } catch (err) {
      // Next redirect throws với digest NEXT_REDIRECT — không phải lỗi thực sự.
      const digest = err instanceof Error ? (err as { digest?: unknown }).digest : undefined;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
      notifyError(err instanceof Error ? err.message : "Xoá thất bại");
    }
  }, [onDelete, deleteConfirm, confirm]);

  const moreItems = more ?? [];
  const useDropdown = moreItems.length > inlineThreshold;
  const inlineItems = useDropdown ? [] : moreItems;

  const runMore = React.useCallback(
    async (item: RowActionItem) => {
      if (item.disabled) return;
      if (item.confirm) {
        const ok = await confirm({
          title: "Xác nhận",
          message: item.confirm,
          tone: item.tone
        });
        if (!ok) return;
      }
      try {
        await item.onSelect();
        notifySuccess(`Đã ${item.label.toLowerCase()}`);
      } catch (err) {
        const digest = err instanceof Error ? (err as { digest?: unknown }).digest : undefined;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
        notifyError(err instanceof Error ? err.message : `${item.label} thất bại`);
      }
    },
    [confirm]
  );

  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {viewHref ? (
        <IconButton
          asChild
          label={viewDisabled ? viewDisabledReason ?? viewLabel : viewLabel}
          variant="ghost"
        >
          <a href={viewHref}>
            <Eye />
          </a>
        </IconButton>
      ) : onView ? (
        <IconButton
          label={viewDisabled ? viewDisabledReason ?? viewLabel : viewLabel}
          variant="ghost"
          onClick={onView}
          disabled={viewDisabled}
        >
          <Eye />
        </IconButton>
      ) : null}

      {editHref ? (
        <IconButton asChild label={editDisabled ? editDisabledReason ?? editLabel : editLabel} variant="ghost">
          <a href={editHref}>
            <Pencil />
          </a>
        </IconButton>
      ) : onEdit ? (
        <IconButton
          label={editDisabled ? editDisabledReason ?? editLabel : editLabel}
          variant="ghost"
          onClick={onEdit}
          disabled={editDisabled}
        >
          <Pencil />
        </IconButton>
      ) : null}

      {inlineItems.map((item, idx) => (
        <IconButton
          key={`${item.label}-${idx}`}
          label={item.label}
          variant={item.tone === "danger" ? "danger" : "ghost"}
          disabled={item.disabled}
          onClick={() => {
            void runMore(item);
          }}
        >
          {item.icon ?? <MoreHorizontal />}
        </IconButton>
      ))}

      {useDropdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Thao tác khác" variant="ghost">
              <MoreHorizontal />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {moreItems.map((item, idx) => {
              const onSelect = async (e: Event) => {
                if (item.disabled) return;
                if (item.confirm) {
                  e.preventDefault();
                  await runMore(item);
                  return;
                }
                await runMore(item);
              };
              return (
                <React.Fragment key={`${item.label}-${idx}`}>
                  {idx > 0 && moreItems[idx - 1].tone !== item.tone && item.tone === "danger" ? (
                    <DropdownMenuSeparator />
                  ) : null}
                  <DropdownMenuItem
                    iconLeft={item.icon}
                    shortcut={item.shortcut}
                    tone={item.tone}
                    disabled={item.disabled}
                    onSelect={onSelect}
                  >
                    {item.label}
                  </DropdownMenuItem>
                </React.Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {onDelete ? (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-admin-line/70" />
          <IconButton
            label={deleteDisabled ? deleteDisabledReason ?? deleteLabel : deleteLabel}
            variant="danger"
            onClick={handleDelete}
            disabled={deleteDisabled}
          >
            <Trash2 />
          </IconButton>
        </>
      ) : null}
    </div>
  );
}
