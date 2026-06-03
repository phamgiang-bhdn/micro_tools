"use client";

import * as React from "react";
import { Package, Mail } from "lucide-react";
import { AdminButton } from "../../../components/admin/ui";
import { runInventoryCheckAction, flushEmailDripAction } from "../actions";

/**
 * Manual trigger buttons cho admin: inventory check + email drip flush.
 * Mặc định cron OFF; admin chạy thủ công khi muốn test.
 */
export function AdminToolTriggers(): React.ReactElement {
  const [busy, setBusy] = React.useState<"inv" | "drip" | null>(null);

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

  const flushDrip = async (): Promise<void> => {
    setBusy("drip");
    try {
      const r = await flushEmailDripAction();
      if (r.ok) {
        alert(`✓ Found ${r.found} due drip\nSent: ${r.sent}\nFailed: ${r.failed}`);
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
      <AdminButton variant="ghost" size="sm" onClick={flushDrip} disabled={busy !== null}>
        <Mail className="size-3.5" />
        {busy === "drip" ? "Đang flush..." : "Flush email drip"}
      </AdminButton>
    </div>
  );
}
