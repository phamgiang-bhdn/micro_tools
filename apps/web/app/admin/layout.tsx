import type React from "react";
import type { Metadata } from "next";
import { AdminShell } from "../../components/admin/shell";

export const metadata: Metadata = {
  title: "Admin · dealvault",
  robots: { index: false, follow: false }
};

/**
 * Admin shell: sidebar nav cố định + topbar. Body có data-shell="admin"
 * để body background xám thay vì canvas cream.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      {/* Áp dụng admin background cho body khi route admin được render */}
      <style>{`body { background-color: #f6f7f9; color: #0f172a; }`}</style>
      <AdminShell>{children}</AdminShell>
    </>
  );
}
