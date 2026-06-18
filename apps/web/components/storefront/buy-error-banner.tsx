"use client";

import type React from "react";
import { useSearchParams } from "next/navigation";

/**
 * STORY 1-3: banner "link mua đang lỗi" khi buyAction redirect về `?buy=error`.
 *
 * Đọc query CLIENT-side (useSearchParams) thay vì server page đọc `searchParams` — nếu server
 * page đọc searchParams, Next 15 ép cả trang product sang dynamic, MẤT ISR (trang load-bearing
 * SEO, revalidate 300). Cách này giữ page static/ISR; banner vẫn hiện sau hydration.
 * Phải nằm dưới <Suspense> (yêu cầu của useSearchParams trên route static) — xem call-site.
 */
export function BuyErrorBanner(): React.ReactElement | null {
  const params = useSearchParams();
  if (params.get("buy") !== "error") return null;
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning-soft px-5 py-3 text-sm text-ink" role="alert">
      <p className="font-semibold">Link mua đang lỗi</p>
      <p className="mt-0.5 text-xs">
        Sản phẩm này tạm thời chưa có link mua hợp lệ. Vui lòng thử lại sau, hoặc xem sản phẩm liên quan bên dưới.
      </p>
    </div>
  );
}
