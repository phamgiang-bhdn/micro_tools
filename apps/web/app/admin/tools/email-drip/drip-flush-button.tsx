"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { AdminButton } from "../../../../components/admin/ui";
import { flushEmailDripAction } from "../../actions";

export function DripFlushButton(): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const handleFlush = async (): Promise<void> => {
    if (!window.confirm("Flush tất cả PENDING drip có scheduledFor <= now?")) return;
    setBusy(true);
    try {
      const r = await flushEmailDripAction();
      if (r.ok) {
        alert(`✓ Found ${r.found} due\nSent: ${r.sent}\nFailed: ${r.failed}`);
        router.refresh();
      } else {
        alert(`Lỗi: ${r.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminButton variant="brand" size="sm" onClick={handleFlush} disabled={busy}>
      <Send className="size-3.5" />
      {busy ? "Đang flush..." : "Flush due drip"}
    </AdminButton>
  );
}
