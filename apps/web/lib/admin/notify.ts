"use client";

import { toast } from "sonner";

/**
 * Wrapper bắt buộc cho mọi mutation từ client (gọi server action trong /admin) để có
 * feedback nhất quán. Tất cả server action ở `app/admin/actions.ts` throw khi fail và
 * void khi success → wrap bằng `withToast(...)` ở chỗ gọi để bắn toast success/error.
 *
 * Pattern (client component):
 *
 *   await withToast(() => createCouponAction(fd), {
 *     loading: "Đang tạo coupon…",
 *     success: "Đã tạo coupon",
 *     error: "Tạo coupon thất bại"
 *   });
 *
 * Nếu prefer ko hiển thị loading: bỏ key `loading`. `error` có thể là string tĩnh hoặc
 * function `(err) => string` để custom message.
 */
export interface ToastMessages {
  loading?: string;
  success?: string | ((result: unknown) => string);
  error?: string | ((err: unknown) => string);
}

export async function withToast<T>(
  run: () => Promise<T>,
  messages: ToastMessages = {}
): Promise<T | null> {
  const { loading, success, error } = messages;
  const toastId = loading ? toast.loading(loading) : undefined;
  try {
    const result = await run();
    const successMsg =
      typeof success === "function" ? success(result) : success ?? "Đã lưu";
    toast.success(successMsg, { id: toastId });
    return result;
  } catch (err) {
    // Next.js redirect() throws a special error that we must rethrow, not toast.
    if (isNextRedirectError(err)) {
      // Dismiss the loading toast — redirect tới page mới sẽ tự revalidate.
      if (toastId !== undefined) toast.dismiss(toastId);
      throw err;
    }
    const errMsg =
      typeof error === "function"
        ? error(err)
        : error ?? (err instanceof Error ? err.message : "Có lỗi xảy ra");
    toast.error(errMsg, { id: toastId });
    return null;
  }
}

/**
 * Toast success/error ngắn, không qua promise (dùng cho action sync).
 */
export function notifySuccess(message: string, description?: string): void {
  toast.success(message, { description });
}

export function notifyError(message: string, description?: string): void {
  toast.error(message, { description });
}

export function notifyInfo(message: string, description?: string): void {
  toast.message(message, { description });
}

// Next.js 15 dùng error có shape { digest: "NEXT_REDIRECT;..." } để báo redirect.
// Không expose helper public của next, nên detect bằng digest prefix.
function isNextRedirectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
