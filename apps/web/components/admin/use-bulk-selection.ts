"use client";

import * as React from "react";

/**
 * Hook quản lý bulk selection cho bảng admin. Trả về set ID đang chọn + helpers
 * tương thích trực tiếp với `selectionColumnRenderers` (xem `bulk-bar.tsx`).
 *
 * `visibleIds` = mảng id của rows đang hiển thị (sau filter + paginate). Header
 * checkbox "select all" chỉ áp lên đám này, không ảnh hưởng rows ngoài trang.
 *
 * Auto-clear selection khi `visibleIds` đổi tập (vd đổi page / đổi filter) để
 * tránh sót selection vô hình.
 */
export function useBulkSelection(visibleIds: string[]): {
  selected: string[];
  count: number;
  isSelected: (id: string) => boolean;
  toggleOne: (id: string, checked: boolean) => void;
  toggleAll: (checked: boolean) => void;
  allSelected: boolean;
  clear: () => void;
} {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  // Khi danh sách visible đổi (filter/page), bỏ những id không còn visible.
  React.useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleIds]);

  const isSelected = React.useCallback((id: string) => selected.has(id), [selected]);

  const toggleOne = React.useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(visibleIds) : new Set());
    },
    [visibleIds]
  );

  const clear = React.useCallback(() => setSelected(new Set()), []);

  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  return {
    selected: Array.from(selected),
    count: selected.size,
    isSelected,
    toggleOne,
    toggleAll,
    allSelected,
    clear
  };
}
