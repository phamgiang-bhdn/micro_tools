import type React from "react";
import Link from "next/link";
import { EmptyState } from "../ui/empty-state";

/**
 * STORY 1-1 (decision B): merchant CÓ THẬT nhưng tạm hết mã active → trang "chưa có mã"
 * (HTTP 200) thay vì 404. Tách thành component để cùng họ với <ExpiredSessionNotice> và
 * giữ giọng/UX dead-end nhất quán (đừng inline JSX mỗi nơi một kiểu).
 */
export function MerchantNoCouponsNotice({ display }: { display: string }): React.ReactElement {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Mã giảm giá</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{display}</h1>
      </header>
      <EmptyState
        tone="warning"
        title={`Hiện ${display} chưa có mã đang dùng`}
        description={
          <p>
            Mã giảm của shop này được cập nhật liên tục. Trong lúc chờ,{" "}
            <Link href="/khuyen-mai" className="font-medium text-primary-700 hover:underline">
              xem mã các shop khác
            </Link>
            .
          </p>
        }
      />
    </main>
  );
}
