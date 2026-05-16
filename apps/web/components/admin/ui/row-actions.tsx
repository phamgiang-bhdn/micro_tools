"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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

/**
 * Chuẩn hoá action ở mỗi hàng list page.
 *
 * Quy ước cứng:
 *  - **Edit**: luôn icon-only nút Pencil, mở dialog hoặc dẫn tới /[id].
 *  - **Delete**: luôn icon-only nút Trash, có window.confirm hoặc dialog confirm.
 *  - **Mọi thao tác khác** (publish, archive, duplicate, toggle, change status…)
 *    GOM HẾT vào dropdown ⋯. Đừng render rời ra row — đó là quy tắc tổ chức UI.
 *
 * Dùng:
 *   <RowActions
 *     onEdit={() => setEditing(row)}
 *     onDelete={async () => deleteCouponAction({ id: row.id })}
 *     deleteConfirm="Xoá mã 'SUMMER25'?"
 *     more={[
 *       { label: "Tạm tắt", icon: <Power />, onSelect: () => toggleAction(row.id) },
 *       { label: "Duplicate", icon: <Copy />, onSelect: () => duplicateAction(row.id) }
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

  /** Actions phụ — gom vào ⋯ dropdown. */
  more?: RowActionItem[];

  className?: string;
}

export function RowActions({
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
    await onDelete();
  }, [onDelete, deleteConfirm, confirm]);

  const hasMore = Boolean(more && more.length > 0);

  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
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

      {onDelete ? (
        <IconButton
          label={deleteDisabled ? deleteDisabledReason ?? deleteLabel : deleteLabel}
          variant="danger"
          onClick={handleDelete}
          disabled={deleteDisabled}
        >
          <Trash2 />
        </IconButton>
      ) : null}

      {hasMore ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Thao tác khác" variant="ghost">
              <MoreHorizontal />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {more!.map((item, idx) => {
              const onSelect = async (e: Event) => {
                if (item.disabled) return;
                if (item.confirm) {
                  e.preventDefault();
                  const ok = await confirm({
                    title: "Xác nhận",
                    message: item.confirm,
                    tone: item.tone
                  });
                  if (!ok) return;
                }
                await item.onSelect();
              };
              return (
                <React.Fragment key={`${item.label}-${idx}`}>
                  {idx > 0 && more![idx - 1].tone !== item.tone && item.tone === "danger" ? (
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
    </div>
  );
}
