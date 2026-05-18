"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminButton } from "../../../components/admin/ui";
import { syncCouponsFromAccesstrade, type CouponSyncResult } from "../actions";

export function SyncCouponsFromAtButton(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"success" | "error" | null>(null);

  const handleClick = (): void => {
    setStatus(null);
    setTone(null);
    startTransition(async () => {
      try {
        const result: CouponSyncResult = await syncCouponsFromAccesstrade();
        setTone("success");
        setStatus(
          `Đã lấy ${result.fetched} mã — ${result.created} mới (chờ duyệt), ${result.updated} cập nhật${
            result.skipped > 0 ? `, ${result.skipped} bỏ qua` : ""
          }.`
        );
        router.refresh();
      } catch (error: unknown) {
        setTone("error");
        setStatus(error instanceof Error ? error.message : "Đồng bộ thất bại — xem log server.");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <AdminButton
        size="sm"
        variant="outline"
        iconLeft={<RefreshCw className={pending ? "animate-spin" : ""} />}
        onClick={handleClick}
        loading={pending}
        disabled={pending}
      >
        Đồng bộ từ Accesstrade
      </AdminButton>
      {status ? (
        <span className={tone === "error" ? "text-xs text-red-600" : "text-xs text-emerald-600"}>
          {status}
        </span>
      ) : null}
    </div>
  );
}
