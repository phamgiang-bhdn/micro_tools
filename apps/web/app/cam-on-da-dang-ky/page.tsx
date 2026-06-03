import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { BRAND } from "../../lib/brand";

export const metadata: Metadata = {
  title: `Cảm ơn đã đăng ký — ${BRAND.name}`,
  robots: { index: false, follow: false }
};

export default function ConfirmedPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-4xl">📧</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">Đã xác nhận đăng ký</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Cảm ơn bạn đã đăng ký nhận deal từ {BRAND.name}. Mỗi 7:00 sáng chúng tôi gửi top 5 deal hot tới email của bạn.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Quay về trang chủ
        </Link>
      </div>
    </article>
  );
}
