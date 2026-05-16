import type React from "react";
import type { Metadata } from "next";
import "react-day-picker/dist/style.css";
import { AdminShell } from "../../components/admin/shell";
import { TooltipProvider } from "../../components/admin/ui/tooltip";
import { ConfirmProvider } from "../../components/admin/ui/confirm-dialog";

export const metadata: Metadata = {
  title: "Admin · dealvault",
  robots: { index: false, follow: false }
};

/**
 * Admin shell: sidebar nav cố định + topbar. Body có data-shell="admin"
 * để body background xám thay vì canvas cream.
 *
 * Bọc <TooltipProvider> ở đây — mọi `<Tooltip>` ở các page admin dùng provider duy nhất
 * này (delayDuration mặc định 200ms, đủ nhanh không nhấp nháy).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      {/* Áp dụng admin background cho body khi route admin được render */}
      <style>{`body { background-color: #f6f7f9; color: #0f172a; }`}</style>
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
        <ConfirmProvider>
          <AdminShell>{children}</AdminShell>
        </ConfirmProvider>
      </TooltipProvider>
    </>
  );
}
