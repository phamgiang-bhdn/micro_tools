"use client";

import { Toaster } from "sonner";

/**
 * Toaster duy nhất cho subtree /admin. Đặt ở admin layout — không lặp lại ở từng page.
 *
 * Hiển thị toast bằng `toast.success(...)`, `toast.error(...)` (import từ "sonner"). Mọi server
 * action mutate đều phải bắn toast qua wrapper client-side trong `lib/admin/notify.ts` —
 * không gọi toast trực tiếp từ component để tránh quên thông báo lỗi.
 */
export function AdminToaster(): React.ReactElement {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand={false}
      duration={3200}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-admin-line !bg-admin-surface !text-admin-ink !shadow-card-md",
          title: "!text-sm !font-semibold",
          description: "!text-xs !text-admin-mute",
          actionButton: "!bg-admin-accent !text-white",
          cancelButton: "!bg-admin-subtle !text-admin-ink"
        }
      }}
    />
  );
}
