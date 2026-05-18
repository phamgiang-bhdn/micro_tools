import type React from "react";
import type { Metadata } from "next";
import "react-day-picker/dist/style.css";
import { AdminShell } from "../../components/admin/shell";
import { TooltipProvider } from "../../components/admin/ui/tooltip";
import { ConfirmProvider } from "../../components/admin/ui/confirm-dialog";
import { AdminToaster } from "../../components/admin/ui/toaster";

export const metadata: Metadata = {
  title: "Admin · dealvault",
  robots: { index: false, follow: false }
};

/**
 * Admin shell — bao bọc toàn bộ subtree /admin với providers cần cho UX nhất quán:
 *  - <TooltipProvider>      : tất cả Tooltip share 1 root, không nhấp nháy
 *  - <ConfirmProvider>      : `useConfirm()` mở dialog confirm thay cho window.confirm
 *  - <AdminToaster>         : toast feedback cho mọi server action (success/error)
 *
 * Body được set data-shell="admin" qua inline style để bật theme admin trong globals.css
 * (background, scrollbar, …) mà không phải đụng vào RootLayout — RootLayout là provider trung lập.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      <style>{`body { background-color: #f4f5fa; color: #0b1220; } body::before { content: ""; display: none; }`}</style>
      <script
        // Đặt data-shell="admin" trên <body> ngay khi mount để globals.css kích hoạt theme admin.
        // Dùng next/script không có sẵn ở RSC scope, nên inline tag thuần là an toàn nhất.
        dangerouslySetInnerHTML={{
          __html: `document.body.setAttribute('data-shell','admin');`
        }}
      />
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
        <ConfirmProvider>
          <AdminShell>{children}</AdminShell>
          <AdminToaster />
        </ConfirmProvider>
      </TooltipProvider>
    </>
  );
}
