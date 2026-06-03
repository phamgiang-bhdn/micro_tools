"use client";

import * as React from "react";
import { Package } from "lucide-react";
import { AdminButton } from "../../../components/admin/ui";
import { runInventoryCheckAction } from "../actions";

/**
 * Manual trigger buttons cho admin: inventory check (OOS).
 * Mặc định cron OFF; admin chạy thủ công khi muốn test.
 */
export function AdminToolTriggers(): React.ReactElement {
  const [busy, setBusy] = React.useState<"inv" | null>(null);

  const runInventory = async (): Promise<void> => {
    if (!window.confirm("Run inventory check cho tất cả product ACTIVE? (~250ms/product)")) return;
    setBusy("inv");
    try {
      const r = await runInventoryCheckAction();
      if (r.ok) {
        alert(`✓ Checked ${r.checked}\nOOS: ${r.flaggedOOS}\nUnknown: ${r.flaggedUnknown}`);
      } else {
        alert(`Lỗi: ${r.error}`);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <AdminButton variant="ghost" size="sm" onClick={runInventory} disabled={busy !== null}>
        <Package className="size-3.5" />
        {busy === "inv" ? "Đang check..." : "Inventory check"}
      </AdminButton>
    </div>
  );
}
