"use client";

import * as React from "react";

export interface UseRowSelectionResult {
  selected: Set<string>;
  toggleOne: (id: string, checked: boolean) => void;
  toggleAll: (checked: boolean) => void;
  clear: () => void;
  allSelected: boolean;
}

/**
 * Row-selection state for bulk actions trên các bảng admin.
 * Pure React, không phụ thuộc gì khác — dùng kèm `<BulkBar>` ở cùng folder.
 */
export function useRowSelection<T extends { id: string }>(rows: T[]): UseRowSelectionResult {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

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
      setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
    },
    [rows]
  );

  const clear = React.useCallback(() => setSelected(new Set()), []);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return { selected, toggleOne, toggleAll, clear, allSelected };
}
